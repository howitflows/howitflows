/**
 * Generator for query-language databases (SQL, CQL, Cypher).
 * Each database supplies statements written with {{param}} tokens; each driver
 * knows how to render placeholders and wrap the statements into a runnable program.
 */
import type { ConnConfig, Lang, OpId, SnippetResult } from '../types';
import { indent, lit, strBlock, Val, SAMPLE_USERS, NEW_USER, READ_MIN_AGE, UPDATE_USER, DELETE_EMAIL } from './util';

type Mode = 'rows' | 'write' | 'ddl';
export interface Stmt {
  label: string;
  text: string;
  params?: Record<string, Val>;
  mode: Mode;
}
interface Rendered {
  label: string;
  text: string;
  params: [string, Val][];
  mode: Mode;
}

type DbId = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'cassandra' | 'neo4j';
type QueryOp = Exclude<OpId, 'docker'>;

// ---------------------------------------------------------------- statements

const sqlValues = (q = "'") =>
  SAMPLE_USERS.map((u) => `  (${q}${u.name}${q}, ${q}${u.email}${q}, ${u.age})`).join(',\n');

const STATEMENTS: Record<DbId, (c: ConnConfig) => Record<QueryOp, Stmt[]>> = {
  postgres: () => ({
    connect: [{ label: 'Check the server version', text: 'SELECT version()', mode: 'rows' }],
    schema: [
      {
        label: 'Create the users table',
        mode: 'ddl',
        text: `CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  age        INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
      },
      { label: 'Index the age column', mode: 'ddl', text: 'CREATE INDEX IF NOT EXISTS idx_users_age ON users (age)' },
    ],
    seed: [
      {
        label: 'Insert sample rows (idempotent)',
        mode: 'write',
        text: `INSERT INTO users (name, email, age) VALUES\n${sqlValues()}\nON CONFLICT (email) DO NOTHING`,
      },
    ],
    create: [
      {
        label: 'Insert one user and return its id',
        mode: 'rows',
        text: 'INSERT INTO users (name, email, age) VALUES ({{name}}, {{email}}, {{age}}) RETURNING id',
        params: { ...NEW_USER },
      },
    ],
    read: [
      {
        label: 'Query users by age',
        mode: 'rows',
        text: 'SELECT id, name, email, age FROM users WHERE age >= {{minAge}} ORDER BY age DESC',
        params: { minAge: READ_MIN_AGE },
      },
    ],
    update: [
      {
        label: 'Update a user by email',
        mode: 'write',
        text: 'UPDATE users SET age = {{age}} WHERE email = {{email}}',
        params: { ...UPDATE_USER },
      },
    ],
    delete: [
      { label: 'Delete a user by email', mode: 'write', text: 'DELETE FROM users WHERE email = {{email}}', params: { email: DELETE_EMAIL } },
    ],
  }),

  mysql: () => ({
    connect: [{ label: 'Check the server version', text: 'SELECT VERSION()', mode: 'rows' }],
    schema: [
      {
        label: 'Create the users table',
        mode: 'ddl',
        text: `CREATE TABLE IF NOT EXISTS users (
  id         BIGINT       AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  age        INT,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_age (age)
) ENGINE=InnoDB`,
      },
    ],
    seed: [
      {
        label: 'Insert sample rows (idempotent)',
        mode: 'write',
        text: `INSERT IGNORE INTO users (name, email, age) VALUES\n${sqlValues()}`,
      },
    ],
    create: [
      {
        label: 'Insert one user',
        mode: 'write',
        text: 'INSERT INTO users (name, email, age) VALUES ({{name}}, {{email}}, {{age}})',
        params: { ...NEW_USER },
      },
    ],
    read: [
      {
        label: 'Query users by age',
        mode: 'rows',
        text: 'SELECT id, name, email, age FROM users WHERE age >= {{minAge}} ORDER BY age DESC',
        params: { minAge: READ_MIN_AGE },
      },
    ],
    update: [
      { label: 'Update a user by email', mode: 'write', text: 'UPDATE users SET age = {{age}} WHERE email = {{email}}', params: { ...UPDATE_USER } },
    ],
    delete: [
      { label: 'Delete a user by email', mode: 'write', text: 'DELETE FROM users WHERE email = {{email}}', params: { email: DELETE_EMAIL } },
    ],
  }),

  sqlite: () => ({
    connect: [{ label: 'Check the library version', text: 'SELECT sqlite_version()', mode: 'rows' }],
    schema: [
      {
        label: 'Create the users table',
        mode: 'ddl',
        text: `CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  age        INTEGER,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
      },
      { label: 'Index the age column', mode: 'ddl', text: 'CREATE INDEX IF NOT EXISTS idx_users_age ON users (age)' },
    ],
    seed: [
      { label: 'Insert sample rows (idempotent)', mode: 'write', text: `INSERT OR IGNORE INTO users (name, email, age) VALUES\n${sqlValues()}` },
    ],
    create: [
      {
        label: 'Insert one user and return its id',
        mode: 'rows',
        text: 'INSERT INTO users (name, email, age) VALUES ({{name}}, {{email}}, {{age}}) RETURNING id',
        params: { ...NEW_USER },
      },
    ],
    read: [
      {
        label: 'Query users by age',
        mode: 'rows',
        text: 'SELECT id, name, email, age FROM users WHERE age >= {{minAge}} ORDER BY age DESC',
        params: { minAge: READ_MIN_AGE },
      },
    ],
    update: [
      { label: 'Update a user by email', mode: 'write', text: 'UPDATE users SET age = {{age}} WHERE email = {{email}}', params: { ...UPDATE_USER } },
    ],
    delete: [
      { label: 'Delete a user by email', mode: 'write', text: 'DELETE FROM users WHERE email = {{email}}', params: { email: DELETE_EMAIL } },
    ],
  }),

  mssql: () => ({
    connect: [{ label: 'Check the server version', text: 'SELECT @@VERSION AS version', mode: 'rows' }],
    schema: [
      {
        label: 'Create the users table',
        mode: 'ddl',
        text: `IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  name       NVARCHAR(100) NOT NULL,
  email      NVARCHAR(255) NOT NULL UNIQUE,
  age        INT NULL,
  created_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
)`,
      },
    ],
    seed: [
      {
        label: 'Insert sample rows',
        mode: 'write',
        text: `INSERT INTO dbo.users (name, email, age) VALUES\n${sqlValues()}`,
      },
    ],
    create: [
      {
        label: 'Insert one user and return its id',
        mode: 'rows',
        text: 'INSERT INTO dbo.users (name, email, age) OUTPUT INSERTED.id VALUES ({{name}}, {{email}}, {{age}})',
        params: { ...NEW_USER },
      },
    ],
    read: [
      {
        label: 'Query users by age',
        mode: 'rows',
        text: 'SELECT id, name, email, age FROM dbo.users WHERE age >= {{minAge}} ORDER BY age DESC',
        params: { minAge: READ_MIN_AGE },
      },
    ],
    update: [
      { label: 'Update a user by email', mode: 'write', text: 'UPDATE dbo.users SET age = {{age}} WHERE email = {{email}}', params: { ...UPDATE_USER } },
    ],
    delete: [
      { label: 'Delete a user by email', mode: 'write', text: 'DELETE FROM dbo.users WHERE email = {{email}}', params: { email: DELETE_EMAIL } },
    ],
  }),

  cassandra: (c) => {
    const ks = c.database || 'app';
    return {
      connect: [{ label: 'Check the cluster version', text: 'SELECT release_version FROM system.local', mode: 'rows' }],
      schema: [
        {
          label: 'Create the keyspace',
          mode: 'ddl',
          text: `CREATE KEYSPACE IF NOT EXISTS ${ks}\n  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`,
        },
        {
          label: 'Create the users table (partitioned by email)',
          mode: 'ddl',
          text: `CREATE TABLE IF NOT EXISTS ${ks}.users (
  email      text PRIMARY KEY,
  name       text,
  age        int,
  created_at timestamp
)`,
        },
      ],
      seed: [
        {
          label: 'Insert sample rows in one batch',
          mode: 'write',
          text:
            'BEGIN BATCH\n' +
            SAMPLE_USERS.map(
              (u) => `  INSERT INTO ${ks}.users (email, name, age, created_at) VALUES ('${u.email}', '${u.name}', ${u.age}, toTimestamp(now()));`,
            ).join('\n') +
            '\nAPPLY BATCH',
        },
      ],
      create: [
        {
          label: 'Insert one user (lightweight transaction)',
          mode: 'rows',
          text: `INSERT INTO ${ks}.users (email, name, age, created_at) VALUES ({{email}}, {{name}}, {{age}}, toTimestamp(now())) IF NOT EXISTS`,
          params: { email: NEW_USER.email, name: NEW_USER.name, age: NEW_USER.age },
        },
      ],
      read: [
        {
          label: 'Query users by age (non-key column needs ALLOW FILTERING)',
          mode: 'rows',
          text: `SELECT email, name, age FROM ${ks}.users WHERE age >= {{minAge}} ALLOW FILTERING`,
          params: { minAge: READ_MIN_AGE },
        },
      ],
      update: [
        {
          label: 'Update a user by partition key',
          mode: 'write',
          text: `UPDATE ${ks}.users SET age = {{age}} WHERE email = {{email}}`,
          params: { ...UPDATE_USER },
        },
      ],
      delete: [
        { label: 'Delete a user by partition key', mode: 'write', text: `DELETE FROM ${ks}.users WHERE email = {{email}}`, params: { email: DELETE_EMAIL } },
      ],
    };
  },

  neo4j: () => ({
    connect: [
      { label: 'Check the server version', text: 'CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition', mode: 'rows' },
    ],
    schema: [
      {
        label: 'Unique constraint on email',
        mode: 'ddl',
        text: 'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
      },
      { label: 'Index on age', mode: 'ddl', text: 'CREATE INDEX user_age IF NOT EXISTS FOR (u:User) ON (u.age)' },
    ],
    seed: [
      {
        label: 'Upsert sample users',
        mode: 'write',
        text:
          'UNWIND [\n' +
          SAMPLE_USERS.map((u) => `  {name: '${u.name}', email: '${u.email}', age: ${u.age}}`).join(',\n') +
          '\n] AS row\nMERGE (u:User {email: row.email})\nSET u.name = row.name, u.age = row.age',
      },
      {
        label: 'Connect them with FOLLOWS relationships',
        mode: 'write',
        text: `MATCH (ada:User {email: 'ada@example.com'}), (alan:User {email: 'alan@example.com'}), (grace:User {email: 'grace@example.com'})
MERGE (ada)-[:FOLLOWS]->(alan)
MERGE (alan)-[:FOLLOWS]->(grace)
MERGE (grace)-[:FOLLOWS]->(ada)`,
      },
    ],
    create: [
      {
        label: 'Create one user node',
        mode: 'rows',
        text: 'CREATE (u:User {name: {{name}}, email: {{email}}, age: {{age}}})\nRETURN elementId(u) AS id, u.name AS name',
        params: { ...NEW_USER },
      },
    ],
    read: [
      {
        label: 'Query users by age, with who they follow',
        mode: 'rows',
        text: `MATCH (u:User) WHERE u.age >= {{minAge}}
OPTIONAL MATCH (u)-[:FOLLOWS]->(f:User)
RETURN u.name AS name, u.age AS age, collect(f.name) AS follows
ORDER BY age DESC`,
        params: { minAge: READ_MIN_AGE },
      },
    ],
    update: [
      {
        label: 'Update a user by email',
        mode: 'rows',
        text: 'MATCH (u:User {email: {{email}}})\nSET u.age = {{age}}\nRETURN u.name AS name, u.age AS age',
        params: { ...UPDATE_USER },
      },
    ],
    delete: [
      {
        label: 'Delete a user and its relationships',
        mode: 'write',
        text: 'MATCH (u:User {email: {{email}}})\nDETACH DELETE u',
        params: { email: DELETE_EMAIL },
      },
    ],
  }),
};

// ---------------------------------------------------------------- rendering

type Ph = (name: string, i: number) => string;
const PH = {
  dollarN: ((_, i) => `$${i}`) as Ph,
  q: (() => '?') as Ph,
  pct: (() => '%s') as Ph,
  at: ((n) => `@${n}`) as Ph,
  atP: ((_, i) => `@p${i}`) as Ph,
  colon: ((n) => `:${n}`) as Ph,
  dollarName: ((n) => `$${n}`) as Ph,
};

const render = (s: Stmt, ph: Ph | 'inline', lang: Lang): Rendered => {
  const params: [string, Val][] = [];
  const seen = new Map<string, number>();
  const text = s.text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = s.params![name];
    if (ph === 'inline') return typeof v === 'number' ? String(v) : `'${v}'`;
    if (!seen.has(name)) {
      params.push([name, v]);
      seen.set(name, params.length);
    }
    return ph(name, params.length);
  });
  void lang;
  return { label: s.label, text, params, mode: s.mode };
};

// ---------------------------------------------------------------- per-language program builders

interface Driver {
  driver: string;
  install: string;
  ph: Ph;
  build: (c: ConnConfig, stmts: Rendered[], op: QueryOp) => string;
  notes?: string;
}

const tuple = (lang: Lang, ps: [string, Val][]) => ps.map(([, v]) => lit(lang, v)).join(', ');

// ---------- Python (DB-API 2.0)
const pyDbApi =
  (imports: string, connect: (c: ConnConfig) => string) =>
  (c: ConnConfig, stmts: Rendered[]) => {
    const body = stmts
      .map((s) => {
        const args = s.params.length ? `, (${tuple('python', s.params)}${s.params.length === 1 ? ',' : ''})` : '';
        const after =
          s.mode === 'rows'
            ? 'for row in cur.fetchall():\n    print(row)'
            : s.mode === 'write'
              ? 'print(cur.rowcount, "row(s) affected")'
              : '';
        return `# ${s.label}\ncur.execute(${strBlock('python', s.text, 0)}${args})${after ? '\n' + after : ''}`;
      })
      .join('\n\n');
    return `${imports}

${connect(c)}
try:
    cur = conn.cursor()

${indent(body, 4)}

    conn.commit()
finally:
    conn.close()
`;
  };

// ---------- Node.js
const nodeProgram = (head: string, body: string, tail: string) => `${head}

try {
${indent(body, 2)}
} finally {
  ${tail}
}
`;

// ---------- Go database/sql
const goDbSql = (driverImport: string, driverName: string, dsn: (c: ConnConfig) => string) => (c: ConnConfig, stmts: Rendered[], op: QueryOp) => {
  const needsRows = stmts.some((s) => s.mode === 'rows');
  const body = stmts
    .map((s) => {
      const args = s.params.length ? ', ' + tuple('go', s.params) : '';
      if (s.mode === 'rows') return `// ${s.label}\nprintRows(db.Query(${strBlock('go', s.text, 0)}${args}))`;
      if (s.mode === 'ddl') return `// ${s.label}\nif _, err := db.Exec(${strBlock('go', s.text, 0)}${args}); err != nil {\n\tlog.Fatal(err)\n}`;
      return `// ${s.label}\nres, err := db.Exec(${strBlock('go', s.text, 0)}${args})\nif err != nil {\n\tlog.Fatal(err)\n}\nn, _ := res.RowsAffected()\nfmt.Println(n, "row(s) affected")`;
    })
    .map((b, _i, arr) => (arr.length > 1 && /^\w+, err :=/m.test(b) ? `{\n${b.split('\n').map((l) => '\t' + l).join('\n')}\n}` : b))
    .join('\n\n');
  const helper = needsRows
    ? `

func printRows(rows *sql.Rows, err error) {
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	cols, _ := rows.Columns()
	vals := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			log.Fatal(err)
		}
		fmt.Println(vals...)
	}
}`
    : '';
  const usesFmt = needsRows || stmts.some((s) => s.mode === 'write');
  return `package main

import (
	"database/sql"
${usesFmt ? '\t"fmt"\n' : ''}	"log"

	_ "${driverImport}"
)

func main() {
	db, err := sql.Open("${driverName}", "${dsn(c)}")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
${op === 'connect' ? '\n\tif err := db.Ping(); err != nil {\n\t\tlog.Fatal(err)\n\t}\n' : ''}
${body.split('\n').map((l) => (l ? '\t' + l : l)).join('\n')}
}${helper}
`;
};

// ---------- Java JDBC
const javaSet = (ps: [string, Val][]) =>
  ps.map(([, v], i) => (typeof v === 'number' ? `ps.setInt(${i + 1}, ${v});` : `ps.setString(${i + 1}, ${lit('java', v)});`)).join('\n');

const javaJdbc = (url: (c: ConnConfig) => string, creds: boolean) => (c: ConnConfig, stmts: Rendered[]) => {
  const body = stmts
    .map((s) => {
      const exec =
        s.mode === 'rows'
          ? 'try (ResultSet rs = ps.executeQuery()) {\n    printRows(rs);\n}'
          : s.mode === 'write'
            ? 'System.out.println(ps.executeUpdate() + " row(s) affected");'
            : 'ps.execute();';
      const sets = s.params.length ? javaSet(s.params) + '\n' : '';
      return `// ${s.label}\ntry (PreparedStatement ps = conn.prepareStatement(${strBlock('java', s.text, 0)})) {\n${indent(sets + exec, 4)}\n}`;
    })
    .join('\n\n');
  const helper = stmts.some((s) => s.mode === 'rows')
    ? `

    static void printRows(ResultSet rs) throws SQLException {
        ResultSetMetaData md = rs.getMetaData();
        while (rs.next()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 1; i <= md.getColumnCount(); i++) {
                sb.append(md.getColumnLabel(i)).append('=').append(rs.getObject(i)).append("  ");
            }
            System.out.println(sb);
        }
    }`
    : '';
  return `import java.sql.*;

public class App {
    public static void main(String[] args) throws SQLException {
        String url = "${url(c)}";
        try (Connection conn = DriverManager.getConnection(url${creds ? `, ${lit('java', c.user)}, ${lit('java', c.password)}` : ''})) {
${indent(body, 12)}
        }
    }${helper}
}
`;
};

// ---------- C# ADO.NET
const csAdo = (ns: string, conn: string, cmd: string, connStr: (c: ConnConfig) => string) => (c: ConnConfig, stmts: Rendered[]) => {
  const body = stmts
    .map((s) => {
      const params = s.params.map(([n, v]) => `cmd.Parameters.AddWithValue("@${n}", ${lit('csharp', v)});`).join('\n');
      const exec =
        s.mode === 'rows'
          ? `await using var reader = await cmd.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    var values = new object[reader.FieldCount];
    reader.GetValues(values);
    Console.WriteLine(string.Join(" | ", values));
}`
          : s.mode === 'write'
            ? 'Console.WriteLine($"{await cmd.ExecuteNonQueryAsync()} row(s) affected");'
            : 'await cmd.ExecuteNonQueryAsync();';
      return `// ${s.label}\nawait using (var cmd = new ${cmd}(${strBlock('csharp', s.text, 0)}, conn))\n{\n${indent((params ? params + '\n' : '') + exec, 4)}\n}`;
    })
    .join('\n\n');
  return `using ${ns};

var connString = "${connStr(c)}";
await using var conn = new ${conn}(connString);
await conn.OpenAsync();

${body}
`;
};

// ---------- PHP PDO
const phpPdo = (dsn: (c: ConnConfig) => string, creds: boolean) => (c: ConnConfig, stmts: Rendered[]) => {
  const body = stmts
    .map((s) => {
      const args = s.params.length ? `[${s.params.map(([n, v]) => `'${n}' => ${lit('php', v)}`).join(', ')}]` : '';
      const after =
        s.mode === 'rows'
          ? 'foreach ($stmt->fetchAll() as $row) {\n    print_r($row);\n}'
          : s.mode === 'write'
            ? 'echo $stmt->rowCount() . " row(s) affected\\n";'
            : '';
      return `// ${s.label}\n$stmt = $pdo->prepare(${strBlock('php', s.text, 0)});\n$stmt->execute(${args});${after ? '\n' + after : ''}`;
    })
    .join('\n\n');
  return `<?php
$pdo = new PDO('${dsn(c)}'${creds ? `, ${lit('php', c.user)}, ${lit('php', c.password)}` : ', null, null'}, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

${body}
`;
};

// ---------- native CLI scripts
const nativeScript = (comment: string, run: (c: ConnConfig) => string, ext: string) => (c: ConnConfig, stmts: Rendered[]) =>
  `${comment} Save as script.${ext}, then run:\n${comment}   ${run(c)}\n\n` +
  stmts.map((s) => `${comment} ${s.label}\n${s.text};`).join('\n\n') +
  '\n';

// ---------------------------------------------------------------- driver table

const pgUrl = (c: ConnConfig) => `postgresql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}`;

const DRIVERS: Record<DbId, Partial<Record<Lang, Driver & { hl?: string }>>> = {
  postgres: {
    native: {
      driver: 'psql',
      install: 'brew install libpq   # or: apt install postgresql-client',
      ph: PH.q,
      build: nativeScript('--', (c) => `psql "${pgUrl(c)}" -f script.sql`, 'sql'),
    },
    python: {
      driver: 'psycopg 3',
      install: 'pip install "psycopg[binary]"',
      ph: PH.pct,
      build: pyDbApi(
        'import psycopg',
        (c) =>
          `conn = psycopg.connect(\n    host=${lit('python', c.host)},\n    port=${c.port},\n    user=${lit('python', c.user)},\n    password=${lit('python', c.password)},\n    dbname=${lit('python', c.database)},\n)`,
      ),
    },
    node: {
      driver: 'node-postgres (pg)',
      install: 'npm install pg',
      ph: PH.dollarN,
      build: (c, stmts) =>
        nodeProgram(
          `import pg from 'pg';

const client = new pg.Client({
  host: '${c.host}',
  port: ${c.port},
  user: '${c.user}',
  password: '${c.password}',
  database: '${c.database}',
});
await client.connect();`,
          stmts
            .map((s) => {
              const args = s.params.length ? `, [${tuple('node', s.params)}]` : '';
              const call = `await client.query(${strBlock('node', s.text, 0)}${args})`;
              if (s.mode === 'rows') return `// ${s.label}\nconst { rows } = ${call};\nconsole.table(rows);`;
              if (s.mode === 'write') return `// ${s.label}\nconst { rowCount } = ${call};\nconsole.log(\`\${rowCount} row(s) affected\`);`;
              return `// ${s.label}\n${call};`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'await client.end();',
        ),
    },
    go: {
      driver: 'pgx (database/sql)',
      install: 'go get github.com/jackc/pgx/v5',
      ph: PH.dollarN,
      build: goDbSql('github.com/jackc/pgx/v5/stdlib', 'pgx', pgUrl),
    },
    java: {
      driver: 'PostgreSQL JDBC',
      install: '<!-- Maven --> org.postgresql:postgresql:42.7.4',
      ph: PH.q,
      build: javaJdbc((c) => `jdbc:postgresql://${c.host}:${c.port}/${c.database}`, true),
    },
    csharp: {
      driver: 'Npgsql',
      install: 'dotnet add package Npgsql',
      ph: PH.at,
      build: csAdo('Npgsql', 'NpgsqlConnection', 'NpgsqlCommand', (c) => `Host=${c.host};Port=${c.port};Username=${c.user};Password=${c.password};Database=${c.database}`),
    },
    php: {
      driver: 'PDO pgsql',
      install: 'apt install php-pgsql   # enables the pdo_pgsql extension',
      ph: PH.colon,
      build: phpPdo((c) => `pgsql:host=${c.host};port=${c.port};dbname=${c.database}`, true),
    },
  },

  mysql: {
    native: {
      driver: 'mysql client',
      install: 'brew install mysql-client   # or: apt install mysql-client',
      ph: PH.q,
      build: nativeScript('--', (c) => `mysql -h ${c.host} -P ${c.port} -u ${c.user} -p'${c.password}' ${c.database} < script.sql`, 'sql'),
    },
    python: {
      driver: 'mysql-connector-python',
      install: 'pip install mysql-connector-python',
      ph: PH.pct,
      build: pyDbApi(
        'import mysql.connector',
        (c) =>
          `conn = mysql.connector.connect(\n    host=${lit('python', c.host)},\n    port=${c.port},\n    user=${lit('python', c.user)},\n    password=${lit('python', c.password)},\n    database=${lit('python', c.database)},\n)`,
      ),
    },
    node: {
      driver: 'mysql2',
      install: 'npm install mysql2',
      ph: PH.q,
      build: (c, stmts) =>
        nodeProgram(
          `import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '${c.host}',
  port: ${c.port},
  user: '${c.user}',
  password: '${c.password}',
  database: '${c.database}',
});`,
          stmts
            .map((s) => {
              const args = s.params.length ? `, [${tuple('node', s.params)}]` : '';
              const call = `await conn.execute(${strBlock('node', s.text, 0)}${args})`;
              if (s.mode === 'rows') return `// ${s.label}\nconst [rows] = ${call};\nconsole.table(rows);`;
              if (s.mode === 'write') return `// ${s.label}\nconst [result] = ${call};\nconsole.log(\`\${result.affectedRows} row(s) affected\`);`;
              return `// ${s.label}\n${call};`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'await conn.end();',
        ),
    },
    go: {
      driver: 'go-sql-driver/mysql',
      install: 'go get github.com/go-sql-driver/mysql',
      ph: PH.q,
      build: goDbSql('github.com/go-sql-driver/mysql', 'mysql', (c) => `${c.user}:${c.password}@tcp(${c.host}:${c.port})/${c.database}?parseTime=true`),
    },
    java: {
      driver: 'MySQL Connector/J',
      install: '<!-- Maven --> com.mysql:mysql-connector-j:9.1.0',
      ph: PH.q,
      build: javaJdbc((c) => `jdbc:mysql://${c.host}:${c.port}/${c.database}`, true),
    },
    csharp: {
      driver: 'MySqlConnector',
      install: 'dotnet add package MySqlConnector',
      ph: PH.at,
      build: csAdo('MySqlConnector', 'MySqlConnection', 'MySqlCommand', (c) => `Server=${c.host};Port=${c.port};User ID=${c.user};Password=${c.password};Database=${c.database}`),
    },
    php: {
      driver: 'PDO mysql',
      install: 'apt install php-mysql   # enables the pdo_mysql extension',
      ph: PH.colon,
      build: phpPdo((c) => `mysql:host=${c.host};port=${c.port};dbname=${c.database};charset=utf8mb4`, true),
    },
  },

  sqlite: {
    native: {
      driver: 'sqlite3 CLI',
      install: 'brew install sqlite   # or: apt install sqlite3',
      ph: PH.q,
      build: nativeScript('--', (c) => `sqlite3 ${c.database} < script.sql`, 'sql'),
    },
    python: {
      driver: 'sqlite3 (stdlib)',
      install: '# built into Python — nothing to install',
      ph: PH.q,
      build: pyDbApi('import sqlite3', (c) => `conn = sqlite3.connect(${lit('python', c.database)})`),
    },
    node: {
      driver: 'better-sqlite3',
      install: 'npm install better-sqlite3',
      ph: PH.q,
      build: (c, stmts) =>
        nodeProgram(
          `import Database from 'better-sqlite3';

const db = new Database('${c.database}');
db.pragma('journal_mode = WAL');`,
          stmts
            .map((s) => {
              const args = s.params.length ? tuple('node', s.params) : '';
              const prep = `db.prepare(${strBlock('node', s.text, 0)})`;
              if (s.mode === 'rows') return `// ${s.label}\nconsole.table(${prep}.all(${args}));`;
              if (s.mode === 'write') return `// ${s.label}\nconst { changes } = ${prep}.run(${args});\nconsole.log(\`\${changes} row(s) affected\`);`;
              return `// ${s.label}\n${prep}.run();`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'db.close();',
        ),
    },
    go: {
      driver: 'modernc.org/sqlite (pure Go)',
      install: 'go get modernc.org/sqlite',
      ph: PH.q,
      build: goDbSql('modernc.org/sqlite', 'sqlite', (c) => c.database),
    },
    java: {
      driver: 'sqlite-jdbc',
      install: '<!-- Maven --> org.xerial:sqlite-jdbc:3.47.1.0',
      ph: PH.q,
      build: javaJdbc((c) => `jdbc:sqlite:${c.database}`, false),
    },
    csharp: {
      driver: 'Microsoft.Data.Sqlite',
      install: 'dotnet add package Microsoft.Data.Sqlite',
      ph: PH.at,
      build: csAdo('Microsoft.Data.Sqlite', 'SqliteConnection', 'SqliteCommand', (c) => `Data Source=${c.database}`),
    },
    php: {
      driver: 'PDO sqlite',
      install: 'apt install php-sqlite3   # enables the pdo_sqlite extension',
      ph: PH.colon,
      build: phpPdo((c) => `sqlite:${c.database}`, false),
    },
  },

  mssql: {
    native: {
      driver: 'sqlcmd',
      install: 'brew install sqlcmd   # or: winget install sqlcmd',
      ph: PH.q,
      build: nativeScript('--', (c) => `sqlcmd -S ${c.host},${c.port} -U ${c.user} -P '${c.password}' -d ${c.database} -C -i script.sql`, 'sql'),
    },
    python: {
      driver: 'pymssql',
      install: 'pip install pymssql',
      ph: PH.pct,
      build: pyDbApi(
        'import pymssql',
        (c) =>
          `conn = pymssql.connect(\n    server=${lit('python', c.host)},\n    port=${c.port},\n    user=${lit('python', c.user)},\n    password=${lit('python', c.password)},\n    database=${lit('python', c.database)},\n)`,
      ),
    },
    node: {
      driver: 'mssql (tedious)',
      install: 'npm install mssql',
      ph: PH.at,
      build: (c, stmts) =>
        nodeProgram(
          `import sql from 'mssql';

const pool = await sql.connect({
  server: '${c.host}',
  port: ${c.port},
  user: '${c.user}',
  password: '${c.password}',
  database: '${c.database}',
  options: { trustServerCertificate: true }, // local dev only
});`,
          stmts
            .map((s) => {
              const inputs = s.params.map(([n, v]) => `\n  .input('${n}', ${lit('node', v)})`).join('');
              const call = `await pool.request()${inputs}\n  .query(${strBlock('node', s.text, 2)})`;
              if (s.mode === 'rows') return `// ${s.label}\nconst { recordset } = ${call};\nconsole.table(recordset);`;
              if (s.mode === 'write') return `// ${s.label}\nconst { rowsAffected } = ${call};\nconsole.log(\`\${rowsAffected[0]} row(s) affected\`);`;
              return `// ${s.label}\n${call};`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'await pool.close();',
        ),
    },
    go: {
      driver: 'microsoft/go-mssqldb',
      install: 'go get github.com/microsoft/go-mssqldb',
      ph: PH.atP,
      build: goDbSql('github.com/microsoft/go-mssqldb', 'sqlserver', (c) => `sqlserver://${c.user}:${c.password}@${c.host}:${c.port}?database=${c.database}`),
    },
    java: {
      driver: 'Microsoft JDBC Driver',
      install: '<!-- Maven --> com.microsoft.sqlserver:mssql-jdbc:12.8.1.jre11',
      ph: PH.q,
      build: javaJdbc((c) => `jdbc:sqlserver://${c.host}:${c.port};databaseName=${c.database};encrypt=true;trustServerCertificate=true`, true),
    },
    csharp: {
      driver: 'Microsoft.Data.SqlClient',
      install: 'dotnet add package Microsoft.Data.SqlClient',
      ph: PH.at,
      build: csAdo(
        'Microsoft.Data.SqlClient',
        'SqlConnection',
        'SqlCommand',
        (c) => `Server=${c.host},${c.port};User Id=${c.user};Password=${c.password};Database=${c.database};TrustServerCertificate=True`,
      ),
    },
    php: {
      driver: 'PDO sqlsrv',
      install: 'pecl install sqlsrv pdo_sqlsrv',
      ph: PH.colon,
      build: phpPdo((c) => `sqlsrv:Server=${c.host},${c.port};Database=${c.database};TrustServerCertificate=1`, true),
    },
  },

  cassandra: {
    native: {
      driver: 'cqlsh',
      install: 'pip install cqlsh',
      ph: PH.q,
      build: nativeScript('--', (c) => `cqlsh ${c.host} ${c.port} -u ${c.user} -p '${c.password}' -f script.cql`, 'cql'),
    },
    python: {
      driver: 'cassandra-driver',
      install: 'pip install cassandra-driver',
      ph: PH.pct,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const args = s.params.length ? `, (${tuple('python', s.params)}${s.params.length === 1 ? ',' : ''})` : '';
            const call = `session.execute(${strBlock('python', s.text, 0)}${args})`;
            return `# ${s.label}\n${s.mode === 'rows' ? `for row in ${call}:\n    print(row)` : call}`;
          })
          .join('\n\n');
        return `from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import Cluster

auth = PlainTextAuthProvider(username=${lit('python', c.user)}, password=${lit('python', c.password)})
cluster = Cluster([${lit('python', c.host)}], port=${c.port}, auth_provider=auth)
session = cluster.connect()
try:
${indent(body, 4)}
finally:
    cluster.shutdown()
`;
      },
    },
    node: {
      driver: 'cassandra-driver',
      install: 'npm install cassandra-driver',
      ph: PH.q,
      build: (c, stmts) =>
        nodeProgram(
          `import cassandra from 'cassandra-driver';

const client = new cassandra.Client({
  contactPoints: ['${c.host}:${c.port}'],
  localDataCenter: 'datacenter1',
  credentials: { username: '${c.user}', password: '${c.password}' },
});
await client.connect();`,
          stmts
            .map((s) => {
              const args = s.params.length ? `, [${tuple('node', s.params)}], { prepare: true }` : '';
              const call = `await client.execute(${strBlock('node', s.text, 0)}${args})`;
              return s.mode === 'rows' ? `// ${s.label}\nconst { rows } = ${call};\nconsole.table(rows);` : `// ${s.label}\n${call};`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'await client.shutdown();',
        ),
    },
    go: {
      driver: 'gocql',
      install: 'go get github.com/gocql/gocql',
      ph: PH.q,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const args = s.params.length ? ', ' + tuple('go', s.params) : '';
            const q = `session.Query(${strBlock('go', s.text, 0)}${args})`;
            return s.mode === 'rows'
              ? `// ${s.label}\nprintIter(${q}.Iter())`
              : `// ${s.label}\nif err := ${q}.Exec(); err != nil {\n\tlog.Fatal(err)\n}`;
          })
          .join('\n\n');
        const rows = stmts.some((s) => s.mode === 'rows');
        return `package main

import (
${rows ? '\t"fmt"\n' : ''}	"log"

	"github.com/gocql/gocql"
)

func main() {
	cluster := gocql.NewCluster("${c.host}")
	cluster.Port = ${c.port}
	cluster.Authenticator = gocql.PasswordAuthenticator{Username: "${c.user}", Password: "${c.password}"}

	session, err := cluster.CreateSession()
	if err != nil {
		log.Fatal(err)
	}
	defer session.Close()

${body.split('\n').map((l) => (l ? '\t' + l : l)).join('\n')}
}${
          rows
            ? `

func printIter(iter *gocql.Iter) {
	for {
		row := map[string]any{}
		if !iter.MapScan(row) {
			break
		}
		fmt.Println(row)
	}
	if err := iter.Close(); err != nil {
		log.Fatal(err)
	}
}`
            : ''
        }
`;
      },
    },
    java: {
      driver: 'Apache Cassandra Java driver 4',
      install: '<!-- Maven --> org.apache.cassandra:java-driver-core:4.18.1',
      ph: PH.q,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const args = s.params.length ? ', ' + tuple('java', s.params) : '';
            const call = `session.execute(SimpleStatement.newInstance(${strBlock('java', s.text, 0)}${args}))`;
            return s.mode === 'rows'
              ? `// ${s.label}\nfor (Row row : ${call}) {\n    System.out.println(row.getFormattedContents());\n}`
              : `// ${s.label}\n${call};`;
          })
          .join('\n\n');
        return `import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.cql.SimpleStatement;
import java.net.InetSocketAddress;

public class App {
    public static void main(String[] args) {
        try (CqlSession session = CqlSession.builder()
                .addContactPoint(new InetSocketAddress("${c.host}", ${c.port}))
                .withLocalDatacenter("datacenter1")
                .withAuthCredentials("${c.user}", "${c.password}")
                .build()) {
${indent(body, 12)}
        }
    }
}
`;
      },
    },
    csharp: {
      driver: 'CassandraCSharpDriver',
      install: 'dotnet add package CassandraCSharpDriver',
      ph: PH.q,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const args = s.params.length ? ', ' + tuple('csharp', s.params) : '';
            const call = `await session.ExecuteAsync(new SimpleStatement(${strBlock('csharp', s.text, 0)}${args}))`;
            return s.mode === 'rows'
              ? `// ${s.label}\nforeach (var row in ${call})\n{\n    Console.WriteLine(string.Join(" | ", row));\n}`
              : `// ${s.label}\n${call};`;
          })
          .join('\n\n');
        return `using Cassandra;

var cluster = Cluster.Builder()
    .AddContactPoint("${c.host}")
    .WithPort(${c.port})
    .WithCredentials("${c.user}", "${c.password}")
    .Build();
var session = await cluster.ConnectAsync();

${body}

await cluster.ShutdownAsync();
`;
      },
    },
  },

  neo4j: {
    native: {
      driver: 'cypher-shell',
      install: 'brew install cypher-shell',
      ph: PH.dollarName,
      build: nativeScript('//', (c) => `cypher-shell -a neo4j://${c.host}:${c.port} -u ${c.user} -p '${c.password}' -d ${c.database} -f script.cypher`, 'cypher'),
    },
    python: {
      driver: 'neo4j (official)',
      install: 'pip install neo4j',
      ph: PH.dollarName,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const kw = s.params.map(([n, v]) => `${n}=${lit('python', v)}`).join(', ');
            const call = `driver.execute_query(\n    ${strBlock('python', s.text, 4)},\n    ${kw ? kw + ',\n    ' : ''}database_=${lit('python', c.database)},\n)`;
            return s.mode === 'rows'
              ? `# ${s.label}\nrecords, summary, keys = ${call}\nfor record in records:\n    print(record.data())`
              : `# ${s.label}\nsummary = ${call}.summary\nprint(summary.counters)`;
          })
          .join('\n\n');
        return `from neo4j import GraphDatabase

URI = "neo4j://${c.host}:${c.port}"
AUTH = (${lit('python', c.user)}, ${lit('python', c.password)})

with GraphDatabase.driver(URI, auth=AUTH) as driver:
    driver.verify_connectivity()

${indent(body, 4)}
`;
      },
    },
    node: {
      driver: 'neo4j-driver',
      install: 'npm install neo4j-driver',
      ph: PH.dollarName,
      build: (c, stmts) =>
        nodeProgram(
          `import neo4j from 'neo4j-driver';

const driver = neo4j.driver('neo4j://${c.host}:${c.port}', neo4j.auth.basic('${c.user}', '${c.password}'));
await driver.getServerInfo();`,
          stmts
            .map((s) => {
              // JS numbers are floats; wrap integers so Neo4j stores them as INTEGER
              const params = `{ ${s.params.map(([n, v]) => `${n}: ${typeof v === 'number' ? `neo4j.int(${v})` : lit('node', v)}`).join(', ')} }`;
              const call = `await driver.executeQuery(\n  ${strBlock('node', s.text, 2)},\n  ${s.params.length ? params : '{}'},\n  { database: '${c.database}' },\n)`;
              return s.mode === 'rows'
                ? `// ${s.label}\nconst { records } = ${call};\nconsole.table(records.map((r) => r.toObject()));`
                : `// ${s.label}\nconst { summary } = ${call};\nconsole.log(summary.counters.updates());`;
            })
            .map(blockify('node'))
            .join('\n\n'),
          'await driver.close();',
        ),
    },
    go: {
      driver: 'neo4j-go-driver v5',
      install: 'go get github.com/neo4j/neo4j-go-driver/v5',
      ph: PH.dollarName,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const m = s.params.length ? `map[string]any{${s.params.map(([n, v]) => `"${n}": ${lit('go', v)}`).join(', ')}}` : 'nil';
            return `// ${s.label}\nprintResult(neo4j.ExecuteQuery(ctx, driver, ${strBlock('go', s.text, 0)},\n\t${m}, neo4j.EagerResultTransformer,\n\tneo4j.ExecuteQueryWithDatabase("${c.database}")))`;
          })
          .join('\n\n');
        return `package main

import (
	"context"
	"fmt"
	"log"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func main() {
	ctx := context.Background()
	driver, err := neo4j.NewDriverWithContext("neo4j://${c.host}:${c.port}", neo4j.BasicAuth("${c.user}", "${c.password}", ""))
	if err != nil {
		log.Fatal(err)
	}
	defer driver.Close(ctx)
	if err := driver.VerifyConnectivity(ctx); err != nil {
		log.Fatal(err)
	}

${body.split('\n').map((l) => (l ? '\t' + l : l)).join('\n')}
}

func printResult(res *neo4j.EagerResult, err error) {
	if err != nil {
		log.Fatal(err)
	}
	for _, rec := range res.Records {
		fmt.Println(rec.AsMap())
	}
	fmt.Printf("%+v\\n", res.Summary.Counters())
}
`;
      },
    },
    java: {
      driver: 'neo4j-java-driver',
      install: '<!-- Maven --> org.neo4j.driver:neo4j-java-driver:5.27.0',
      ph: PH.dollarName,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const params = s.params.length ? `\n        .withParameters(Map.of(${s.params.map(([n, v]) => `"${n}", ${lit('java', v)}`).join(', ')}))` : '';
            return `// ${s.label}\nvar r = driver.executableQuery(${strBlock('java', s.text, 4)})${params}\n        .withConfig(config)\n        .execute();\nr.records().forEach(rec -> System.out.println(rec.asMap()));`;
          })
          .map((b) => `{\n${indent(b, 4)}\n}`)
          .join('\n');
        return `import java.util.Map;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.QueryConfig;

public class App {
    public static void main(String[] args) {
        try (var driver = GraphDatabase.driver("neo4j://${c.host}:${c.port}", AuthTokens.basic("${c.user}", "${c.password}"))) {
            driver.verifyConnectivity();
            var config = QueryConfig.builder().withDatabase("${c.database}").build();

${indent(body, 12)}
        }
    }
}
`;
      },
    },
    csharp: {
      driver: 'Neo4j.Driver',
      install: 'dotnet add package Neo4j.Driver',
      ph: PH.dollarName,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const params = s.params.length ? `\n    .WithParameters(new { ${s.params.map(([n, v]) => `${n} = ${lit('csharp', v)}`).join(', ')} })` : '';
            return `// ${s.label}\n{\n    var result = await driver.ExecutableQuery(${strBlock('csharp', s.text, 4)})${params.replace(/\n/g, '\n    ')}\n        .WithConfig(config)\n        .ExecuteAsync();\n    foreach (var record in result.Result)\n        Console.WriteLine(string.Join(", ", record.Values.Select(kv => $"{kv.Key}={kv.Value}")));\n}`;
          })
          .join('\n\n');
        return `using Neo4j.Driver;

await using var driver = GraphDatabase.Driver("neo4j://${c.host}:${c.port}", AuthTokens.Basic("${c.user}", "${c.password}"));
await driver.VerifyConnectivityAsync();
var config = new QueryConfig(database: "${c.database}");

${body}
`;
      },
    },
    php: {
      driver: 'laudis/neo4j-php-client',
      install: 'composer require laudis/neo4j-php-client',
      ph: PH.dollarName,
      build: (c, stmts) => {
        const body = stmts
          .map((s) => {
            const args = s.params.length ? `, [${s.params.map(([n, v]) => `'${n}' => ${lit('php', v)}`).join(', ')}]` : '';
            return `// ${s.label}\n$result = $client->run(${strBlock('php', s.text, 0)}${args});\nforeach ($result as $record) {\n    print_r($record->toArray());\n}`;
          })
          .join('\n\n');
        return `<?php
require __DIR__ . '/vendor/autoload.php';

use Laudis\\Neo4j\\ClientBuilder;

$client = ClientBuilder::create()
    ->withDriver('default', 'neo4j://${c.user}:${c.password}@${c.host}:${c.port}')
    ->withDefaultDriver('default')
    ->build();

${body}
`;
      },
    },
  },
};

/** In JS, consecutive `const { rows } = ...` would clash — wrap each statement in its own block when there are several. */
function blockify(_lang: 'node') {
  return (b: string, _i: number, arr: string[]) => (arr.length > 1 && /\bconst\b/.test(b) ? `{\n${indent(b, 2)}\n}` : b);
}

const HL: Record<Lang, string> = {
  native: 'sql',
  python: 'python',
  node: 'javascript',
  go: 'go',
  java: 'java',
  csharp: 'csharp',
  php: 'php',
};
const FILE: Record<Lang, string> = {
  native: 'script.sql',
  python: 'main.py',
  node: 'index.mjs',
  go: 'main.go',
  java: 'App.java',
  csharp: 'Program.cs',
  php: 'index.php',
};

export const QUERY_DBS = Object.keys(STATEMENTS) as DbId[];

export function generateQuery(db: string, lang: Lang, op: QueryOp, cfg: ConnConfig): SnippetResult {
  const drv = DRIVERS[db as DbId]?.[lang];
  if (!drv)
    return {
      unsupported:
        db === 'cassandra' && lang === 'php'
          ? 'The DataStax PHP driver for Cassandra was archived and has no maintained replacement.'
          : 'No maintained driver for this language.',
    };
  const raw = STATEMENTS[db as DbId](cfg)[op];
  const stmts = raw.map((s) => render(s, lang === 'native' ? 'inline' : drv.ph, lang));
  let code = drv.build(cfg, stmts, op);
  let file = FILE[lang];
  let hl = HL[lang];
  if (lang === 'native') {
    if (db === 'cassandra') file = 'script.cql';
    if (db === 'neo4j') {
      file = 'script.cypher';
      hl = 'cypher';
    }
  }
  code = code.replace(/\n{3,}/g, '\n\n');
  return { code, hl, install: drv.install, driver: drv.driver, filename: file, notes: drv.notes };
}
