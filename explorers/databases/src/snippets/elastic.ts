import type { ConnConfig } from '../types';
import { ApiDb, QueryOp, goBody } from './api';
import { indent, objLit, goImports, SAMPLE_USERS, NEW_USER, READ_MIN_AGE, UPDATE_USER, DELETE_EMAIL } from './util';

const base = (c: ConnConfig) => `http://${c.host}:${c.port}`;
const IDX = 'users';
const MAPPINGS = {
  properties: {
    name: { type: 'text' },
    email: { type: 'keyword' },
    age: { type: 'integer' },
    created_at: { type: 'date' },
  },
};
const QUERY = { range: { age: { gte: READ_MIN_AGE } } };
const SORT = [{ age: 'desc' }];

interface Call {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  path: string;
  body?: string; // JSON or NDJSON
  label: string;
}

const bulkNdjson = SAMPLE_USERS.map((u) => `{"index":{"_index":"${IDX}","_id":"${u.email}"}}\n${JSON.stringify(u)}`).join('\n') + '\n';

/** The REST calls behind each operation — used by curl, Go, Java and C#. */
const CALLS: Record<QueryOp, Call[]> = {
  connect: [{ method: 'GET', path: '/', label: 'Cluster info (version, name)' }],
  schema: [{ method: 'PUT', path: `/${IDX}`, body: JSON.stringify({ mappings: MAPPINGS }, null, 2), label: 'Create the index with explicit mappings' }],
  seed: [{ method: 'POST', path: '/_bulk?refresh=true', body: bulkNdjson, label: 'Bulk-index sample docs (email as _id -> idempotent)' }],
  create: [
    {
      method: 'PUT',
      path: `/${IDX}/_doc/${NEW_USER.email}?refresh=true`,
      body: JSON.stringify({ ...NEW_USER, created_at: '2026-01-01T00:00:00Z' }, null, 2),
      label: 'Index one document',
    },
  ],
  read: [{ method: 'POST', path: `/${IDX}/_search`, body: JSON.stringify({ query: QUERY, sort: SORT }, null, 2), label: 'Search: age >= 40' }],
  update: [
    { method: 'POST', path: `/${IDX}/_update/${UPDATE_USER.email}`, body: JSON.stringify({ doc: { age: UPDATE_USER.age } }, null, 2), label: 'Partial update' },
  ],
  delete: [{ method: 'DELETE', path: `/${IDX}/_doc/${DELETE_EMAIL}`, label: 'Delete by id' }],
};

const ctype = (p: string) => (p.startsWith('/_bulk') ? 'application/x-ndjson' : 'application/json');
const ops = (fn: (calls: Call[], c: ConnConfig) => string) =>
  Object.fromEntries((Object.keys(CALLS) as QueryOp[]).map((op) => [op, (c: ConnConfig) => fn(CALLS[op], c)])) as Record<QueryOp, (c: ConnConfig) => string>;

export const ELASTIC: ApiDb = {
  native: {
    driver: 'curl',
    install: '# curl ships with macOS, Windows 10+ and most Linux distros',
    hl: 'bash',
    file: 'requests.sh',
    wrap: (c, body) => `ES="${base(c)}"\nAUTH="${c.user}:${c.password}"\n\n${body}\n`,
    ops: ops((calls) =>
      calls
        .map(
          (k) =>
            `# ${k.label}\ncurl -s -u "$AUTH" -X ${k.method} "$ES${k.path}"` +
            (k.body ? ` \\\n  -H 'Content-Type: ${ctype(k.path)}' \\\n  --data-binary @- <<'JSON'\n${k.body.trimEnd()}\nJSON` : ''),
        )
        .join('\n\n'),
    ),
  },

  python: {
    driver: 'elasticsearch-py 8',
    install: 'pip install "elasticsearch>=8,<9"',
    wrap: (c, body) => `from elasticsearch import Elasticsearch, helpers

es = Elasticsearch("${base(c)}", basic_auth=("${c.user}", "${c.password}"))

${body}
`,
    ops: {
      connect: () => `info = es.info()\nprint(info["cluster_name"], info["version"]["number"])`,
      schema: () =>
        `if not es.indices.exists(index="${IDX}"):\n    es.indices.create(index="${IDX}", mappings=${objLit('python', MAPPINGS, 4)})\nprint(es.indices.get_mapping(index="${IDX}"))`,
      seed: () =>
        `sample = ${objLit('python', SAMPLE_USERS)}\n# email as _id makes re-runs overwrite instead of duplicating\nactions = ({"_index": "${IDX}", "_id": u["email"], "_source": u} for u in sample)\nok, errors = helpers.bulk(es, actions, refresh=True)\nprint(ok, "indexed", errors)`,
      create: () =>
        `from datetime import datetime, timezone\n\ndoc = {**${objLit('python', NEW_USER)}, "created_at": datetime.now(timezone.utc)}\nres = es.index(index="${IDX}", id=doc["email"], document=doc, refresh=True)\nprint(res["result"], res["_id"])`,
      read: () =>
        `res = es.search(index="${IDX}", query=${objLit('python', QUERY)}, sort=[{"age": "desc"}])\nfor hit in res["hits"]["hits"]:\n    print(hit["_id"], hit["_source"])`,
      update: () => `res = es.update(index="${IDX}", id="${UPDATE_USER.email}", doc={"age": ${UPDATE_USER.age}})\nprint(res["result"])`,
      delete: () => `res = es.delete(index="${IDX}", id="${DELETE_EMAIL}")\nprint(res["result"])`,
    },
  },

  node: {
    driver: '@elastic/elasticsearch 8',
    install: 'npm install @elastic/elasticsearch@8',
    wrap: (c, body) => `import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: '${base(c)}',
  auth: { username: '${c.user}', password: '${c.password}' },
});

${body}
`,
    ops: {
      connect: () => `const info = await client.info();\nconsole.log(info.cluster_name, info.version.number);`,
      schema: () =>
        `if (!(await client.indices.exists({ index: '${IDX}' }))) {\n  await client.indices.create({\n    index: '${IDX}',\n    mappings: ${objLit('node', MAPPINGS, 4)},\n  });\n}\nconsole.log(await client.indices.getMapping({ index: '${IDX}' }));`,
      seed: () =>
        `const sample = ${objLit('node', SAMPLE_USERS)};\n// email as _id makes re-runs overwrite instead of duplicating\nconst stats = await client.helpers.bulk({\n  datasource: sample,\n  onDocument: (doc) => ({ index: { _index: '${IDX}', _id: doc.email } }),\n  refreshOnCompletion: true,\n});\nconsole.log(stats);`,
      create: () =>
        `const res = await client.index({\n  index: '${IDX}',\n  id: '${NEW_USER.email}',\n  document: { ...${objLit('node', NEW_USER)}, created_at: new Date() },\n  refresh: true,\n});\nconsole.log(res.result, res._id);`,
      read: () =>
        `const res = await client.search({\n  index: '${IDX}',\n  query: ${objLit('node', QUERY)},\n  sort: [{ age: 'desc' }],\n});\nconsole.table(res.hits.hits.map((h) => h._source));`,
      update: () => `const res = await client.update({ index: '${IDX}', id: '${UPDATE_USER.email}', doc: { age: ${UPDATE_USER.age} } });\nconsole.log(res.result);`,
      delete: () => `const res = await client.delete({ index: '${IDX}', id: '${DELETE_EMAIL}' });\nconsole.log(res.result);`,
    },
  },

  go: {
    driver: 'go-elasticsearch v8',
    install: 'go get github.com/elastic/go-elasticsearch/v8',
    wrap: (c, body) => {
      const main = `func main() {
	es, err := elasticsearch.NewClient(elasticsearch.Config{
		Addresses: []string{"${base(c)}"},
		Username:  "${c.user}",
		Password:  "${c.password}",
	})
	if err != nil {
		log.Fatal(err)
	}

${goBody(body)}
}

// do sends a raw REST request through the client (handles auth, retries, node selection).
func do(es *elasticsearch.Client, method, path, body string) {
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req, _ := http.NewRequest(method, path, r)
	if body != "" {
		ct := "application/json"
		if strings.HasPrefix(path, "/_bulk") {
			ct = "application/x-ndjson"
		}
		req.Header.Set("Content-Type", ct)
	}
	res, err := es.Perform(req)
	if err != nil {
		log.Fatal(err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	fmt.Println(res.Status, string(out))
}
`;
      return `package main\n\n${goImports(main, ['fmt', 'io', 'log', 'net/http', 'strings'], ['github.com/elastic/go-elasticsearch/v8'])}\n\n${main}`;
    },
    ops: ops((calls) =>
      calls.map((k) => `// ${k.label}\ndo(es, "${k.method}", "${k.path}", ${k.body ? '`' + (k.path.startsWith('/_bulk') ? k.body : k.body.trimEnd()) + '`' : '""'})`).join('\n\n'),
    ),
  },

  java: {
    driver: 'java.net.http (REST)',
    install: '# no dependency — uses the JDK 11+ HttpClient against the REST API',
    notes: 'Elasticsearch is a JSON-over-HTTP API, so any HTTP client works. The typed co.elastic.clients:elasticsearch-java client is an alternative.',
    wrap: (c, body) => `import java.net.URI;
import java.net.http.*;
import java.util.Base64;

public class App {
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static final String BASE = "${base(c)}";
    static final String AUTH = "Basic " + Base64.getEncoder().encodeToString("${c.user}:${c.password}".getBytes());

    public static void main(String[] args) throws Exception {
${indent(body, 8)}
    }

    static void call(String method, String path, String body) throws Exception {
        var req = HttpRequest.newBuilder(URI.create(BASE + path))
                .header("Authorization", AUTH)
                .header("Content-Type", path.startsWith("/_bulk") ? "application/x-ndjson" : "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body))
                .build();
        var res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(res.statusCode() + " " + res.body());
    }
}
`,
    ops: ops((calls) =>
      calls
        .map(
          (k) =>
            `// ${k.label}\ncall("${k.method}", "${k.path}", ${k.body ? `"""\n${indent(k.body.trimEnd(), 8)}\n        """` : 'null'});`, // a Java text block already ends with \n, which _bulk needs
        )
        .join('\n\n'),
    ),
  },

  csharp: {
    driver: 'HttpClient (REST)',
    install: '# no dependency — uses System.Net.Http against the REST API',
    notes: 'Elasticsearch is a JSON-over-HTTP API, so any HTTP client works. The typed Elastic.Clients.Elasticsearch package is an alternative.',
    wrap: (c, body) => `using System.Net.Http.Headers;
using System.Text;

var http = new HttpClient { BaseAddress = new Uri("${base(c)}") };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
    "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes("${c.user}:${c.password}")));

${body}

async Task Call(HttpMethod method, string path, string? body = null)
{
    var req = new HttpRequestMessage(method, path);
    if (body != null)
        req.Content = new StringContent(body, Encoding.UTF8, path.StartsWith("/_bulk") ? "application/x-ndjson" : "application/json");
    var res = await http.SendAsync(req);
    Console.WriteLine($"{(int)res.StatusCode} {await res.Content.ReadAsStringAsync()}");
}
`,
    ops: ops((calls) =>
      calls
        .map((k) => {
          const m = `HttpMethod.${k.method[0] + k.method.slice(1).toLowerCase()}`;
          return `// ${k.label}\nawait Call(${m}, "${k.path}"${k.body ? `, """\n${indent(k.body.trimEnd(), 4)}\n    """${k.path.startsWith('/_bulk') ? ' + "\\n"' : ''}` : ''});`;
        })
        .join('\n\n'),
    ),
  },

  php: {
    driver: 'elasticsearch-php 8',
    install: 'composer require elasticsearch/elasticsearch:^8',
    wrap: (c, body) => `<?php
require __DIR__ . '/vendor/autoload.php';

use Elastic\\Elasticsearch\\ClientBuilder;

$client = ClientBuilder::create()
    ->setHosts(['${base(c)}'])
    ->setBasicAuthentication('${c.user}', '${c.password}')
    ->build();

${body}
`,
    ops: {
      connect: () => `$info = $client->info()->asArray();\necho $info['cluster_name'], ' ', $info['version']['number'], "\\n";`,
      schema: () =>
        `if (!$client->indices()->exists(['index' => '${IDX}'])->asBool()) {\n    $client->indices()->create([\n        'index' => '${IDX}',\n        'body'  => ['mappings' => ${objLit('php', MAPPINGS, 8)}],\n    ]);\n}\nprint_r($client->indices()->getMapping(['index' => '${IDX}'])->asArray());`,
      seed: () =>
        `$sample = ${objLit('php', SAMPLE_USERS)};\n$body = [];\nforeach ($sample as $u) {\n    // email as _id makes re-runs overwrite instead of duplicating\n    $body[] = ['index' => ['_index' => '${IDX}', '_id' => $u['email']]];\n    $body[] = $u;\n}\n$res = $client->bulk(['body' => $body, 'refresh' => true])->asArray();\necho count($res['items']), " indexed\\n";`,
      create: () =>
        `$res = $client->index([\n    'index'   => '${IDX}',\n    'id'      => '${NEW_USER.email}',\n    'body'    => ${objLit('php', NEW_USER).replace(/]$/, ", 'created_at' => date(DATE_ATOM)]")},\n    'refresh' => true,\n])->asArray();\necho $res['result'], "\\n";`,
      read: () =>
        `$res = $client->search([\n    'index' => '${IDX}',\n    'body'  => [\n        'query' => ['range' => ['age' => ['gte' => ${READ_MIN_AGE}]]],\n        'sort'  => [['age' => 'desc']],\n    ],\n])->asArray();\nforeach ($res['hits']['hits'] as $hit) {\n    echo json_encode($hit['_source']), "\\n";\n}`,
      update: () =>
        `$res = $client->update([\n    'index' => '${IDX}',\n    'id'    => '${UPDATE_USER.email}',\n    'body'  => ['doc' => ['age' => ${UPDATE_USER.age}]],\n])->asArray();\necho $res['result'], "\\n";`,
      delete: () => `$res = $client->delete(['index' => '${IDX}', 'id' => '${DELETE_EMAIL}'])->asArray();\necho $res['result'], "\\n";`,
    },
  },
};
