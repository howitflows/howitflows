import type { ConnConfig } from '../types';
import { ApiDb, goBody } from './api';
import { indent, objLit, goImports, SAMPLE_USERS, NEW_USER, READ_MIN_AGE, UPDATE_USER, DELETE_EMAIL } from './util';

const url = (c: ConnConfig) => `redis://${c.password ? `${c.user || 'default'}:${c.password}@` : ''}${c.host}:${c.port}/${c.database || 0}`;
const U = UPDATE_USER;
const KEYS_DOC = `Key design (Redis has no schema — you design keys instead):
  user:<email>    HASH  { name, email, age }
  users:by_age    ZSET  member=<email>, score=<age>   -> secondary index for range queries`;

export const REDIS: ApiDb = {
  native: {
    driver: 'redis-cli',
    install: 'brew install redis   # or: apt install redis-tools',
    hl: 'bash',
    file: 'script.redis',
    wrap: (c, body) =>
      `# Pipe the commands into redis-cli:\n#   redis-cli -u ${url(c)} < script.redis\n\n${body}\n`,
    ops: {
      connect: () => `PING\nINFO server`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '# ')}\nSET app:schema_version 1`,
      seed: () =>
        `MULTI\n${SAMPLE_USERS.map((u) => `HSET user:${u.email} name "${u.name}" email ${u.email} age ${u.age}\nZADD users:by_age ${u.age} ${u.email}`).join('\n')}\nEXEC`,
      create: () =>
        `MULTI\nHSET user:${NEW_USER.email} name "${NEW_USER.name}" email ${NEW_USER.email} age ${NEW_USER.age}\nZADD users:by_age ${NEW_USER.age} ${NEW_USER.email}\nEXEC`,
      read: () => `# 1) range query on the index\nZRANGE users:by_age ${READ_MIN_AGE} +inf BYSCORE WITHSCORES\n# 2) fetch each hash it returned\nHGETALL user:grace@example.com\nHGETALL user:linus@example.com`,
      update: () => `MULTI\nHSET user:${U.email} age ${U.age}\nZADD users:by_age ${U.age} ${U.email}\nEXEC`,
      delete: () => `MULTI\nDEL user:${DELETE_EMAIL}\nZREM users:by_age ${DELETE_EMAIL}\nEXEC`,
    },
  },

  python: {
    driver: 'redis-py',
    install: 'pip install redis',
    wrap: (c, body) => `import redis

r = redis.Redis(
    host="${c.host}",
    port=${c.port},
    db=${c.database || 0},${c.password ? `\n    username="${c.user || 'default'}",\n    password="${c.password}",` : ''}
    decode_responses=True,
)

try:
${indent(body, 4)}
finally:
    r.close()
`,
    ops: {
      connect: () => `print(r.ping())  # True\nprint("Redis", r.info("server")["redis_version"])`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '# ')}\nr.set("app:schema_version", 1)`,
      seed: () =>
        `sample = ${objLit('python', SAMPLE_USERS)}\n\n# MULTI/EXEC pipeline: one round trip, applied atomically\nwith r.pipeline(transaction=True) as pipe:\n    for u in sample:\n        pipe.hset(f"user:{u['email']}", mapping=u)\n        pipe.zadd("users:by_age", {u["email"]: u["age"]})\n    print(pipe.execute())`,
      create: () =>
        `user = ${objLit('python', NEW_USER)}\nwith r.pipeline() as pipe:\n    pipe.hset(f"user:{user['email']}", mapping=user)\n    pipe.zadd("users:by_age", {user["email"]: user["age"]})\n    pipe.execute()\nprint("created", user["email"])`,
      read: () =>
        `emails = r.zrange("users:by_age", ${READ_MIN_AGE}, "+inf", byscore=True)\nfor email in emails:\n    print(r.hgetall(f"user:{email}"))`,
      update: () =>
        `with r.pipeline() as pipe:\n    pipe.hset("user:${U.email}", "age", ${U.age})\n    pipe.zadd("users:by_age", {"${U.email}": ${U.age}})\n    print(pipe.execute())`,
      delete: () =>
        `with r.pipeline() as pipe:\n    pipe.delete("user:${DELETE_EMAIL}")\n    pipe.zrem("users:by_age", "${DELETE_EMAIL}")\n    print(pipe.execute())  # [keys deleted, members removed]`,
    },
  },

  node: {
    driver: 'node-redis',
    install: 'npm install redis',
    wrap: (c, body) => `import { createClient } from 'redis';

const client = createClient({ url: '${url(c)}' });
client.on('error', (err) => console.error('Redis error', err));
await client.connect();

try {
${indent(body, 2)}
} finally {
  await client.quit();
}
`,
    ops: {
      connect: () => `console.log(await client.ping()); // PONG\nconst info = await client.info('server');\nconsole.log(info.match(/redis_version:(\\S+)/)[1]);`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '// ')}\nawait client.set('app:schema_version', '1');`,
      seed: () =>
        `const sample = ${objLit('node', SAMPLE_USERS)};\n\n// MULTI/EXEC: one round trip, applied atomically\nconst multi = client.multi();\nfor (const u of sample) {\n  multi.hSet(\`user:\${u.email}\`, u);\n  multi.zAdd('users:by_age', { score: u.age, value: u.email });\n}\nconsole.log(await multi.exec());`,
      create: () =>
        `const user = ${objLit('node', NEW_USER)};\nawait client\n  .multi()\n  .hSet(\`user:\${user.email}\`, user)\n  .zAdd('users:by_age', { score: user.age, value: user.email })\n  .exec();\nconsole.log('created', user.email);`,
      read: () =>
        `const emails = await client.zRangeByScore('users:by_age', ${READ_MIN_AGE}, '+inf');\nfor (const email of emails) {\n  console.log(await client.hGetAll(\`user:\${email}\`));\n}`,
      update: () =>
        `const res = await client\n  .multi()\n  .hSet('user:${U.email}', 'age', ${U.age})\n  .zAdd('users:by_age', { score: ${U.age}, value: '${U.email}' })\n  .exec();\nconsole.log(res);`,
      delete: () =>
        `const [deleted, removed] = await client\n  .multi()\n  .del('user:${DELETE_EMAIL}')\n  .zRem('users:by_age', '${DELETE_EMAIL}')\n  .exec();\nconsole.log({ deleted, removed });`,
    },
  },

  go: {
    driver: 'go-redis v9',
    install: 'go get github.com/redis/go-redis/v9',
    wrap: (c, body) => {
      const main = `func main() {
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr:     "${c.host}:${c.port}",${c.password ? `\n\t\tUsername: "${c.user || 'default'}",\n\t\tPassword: "${c.password}",` : ''}
		DB:       ${c.database || 0},
	})
	defer rdb.Close()

${goBody(body)}
}
`;
      return `package main\n\n${goImports(main, ['context', 'fmt', 'log'], ['github.com/redis/go-redis/v9'])}\n\n${main}`;
    },
    ops: {
      connect: () => `pong, err := rdb.Ping(ctx).Result()\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(pong) // PONG`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '// ')}\nif err := rdb.Set(ctx, "app:schema_version", 1, 0).Err(); err != nil {\n\tlog.Fatal(err)\n}`,
      seed: () =>
        `type user struct {\n\tName, Email string\n\tAge         int\n}\nsample := []user{\n${SAMPLE_USERS.map((u) => `\t{"${u.name}", "${u.email}", ${u.age}},`).join('\n')}\n}\n\n// MULTI/EXEC pipeline: one round trip, applied atomically\n_, err := rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {\n\tfor _, u := range sample {\n\t\tpipe.HSet(ctx, "user:"+u.Email, "name", u.Name, "email", u.Email, "age", u.Age)\n\t\tpipe.ZAdd(ctx, "users:by_age", redis.Z{Score: float64(u.Age), Member: u.Email})\n\t}\n\treturn nil\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(len(sample), "users written")`,
      create: () =>
        `_, err := rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {\n\tpipe.HSet(ctx, "user:${NEW_USER.email}", "name", "${NEW_USER.name}", "email", "${NEW_USER.email}", "age", ${NEW_USER.age})\n\tpipe.ZAdd(ctx, "users:by_age", redis.Z{Score: ${NEW_USER.age}, Member: "${NEW_USER.email}"})\n\treturn nil\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("created ${NEW_USER.email}")`,
      read: () =>
        `emails, err := rdb.ZRangeArgs(ctx, redis.ZRangeArgs{\n\tKey: "users:by_age", Start: "${READ_MIN_AGE}", Stop: "+inf", ByScore: true,\n}).Result()\nif err != nil {\n\tlog.Fatal(err)\n}\nfor _, email := range emails {\n\tfmt.Println(rdb.HGetAll(ctx, "user:"+email).Val())\n}`,
      update: () =>
        `_, err := rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {\n\tpipe.HSet(ctx, "user:${U.email}", "age", ${U.age})\n\tpipe.ZAdd(ctx, "users:by_age", redis.Z{Score: ${U.age}, Member: "${U.email}"})\n\treturn nil\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("updated ${U.email}")`,
      delete: () =>
        `cmds, err := rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {\n\tpipe.Del(ctx, "user:${DELETE_EMAIL}")\n\tpipe.ZRem(ctx, "users:by_age", "${DELETE_EMAIL}")\n\treturn nil\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(cmds)`,
    },
  },

  java: {
    driver: 'Jedis',
    install: '<!-- Maven --> redis.clients:jedis:5.2.0',
    wrap: (c, body) => `import java.util.List;
import java.util.Map;
import redis.clients.jedis.*;

public class App {
    public static void main(String[] args) {
        JedisClientConfig config = DefaultJedisClientConfig.builder()${c.password ? `\n                .user("${c.user || 'default'}")\n                .password("${c.password}")` : ''}
                .database(${c.database || 0})
                .build();
        try (JedisPooled jedis = new JedisPooled(new HostAndPort("${c.host}", ${c.port}), config)) {
${indent(body, 12)}
        }
    }
}
`,
    ops: {
      connect: () => `System.out.println(jedis.ping()); // PONG`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '// ')}\njedis.set("app:schema_version", "1");`,
      seed: () =>
        `List<Map<String, String>> sample = List.of(\n${SAMPLE_USERS.map((u) => `        Map.of("name", "${u.name}", "email", "${u.email}", "age", "${u.age}")`).join(',\n')});\n\n// MULTI/EXEC: one round trip, applied atomically\ntry (AbstractTransaction tx = jedis.multi()) {\n    for (Map<String, String> u : sample) {\n        tx.hset("user:" + u.get("email"), u);\n        tx.zadd("users:by_age", Double.parseDouble(u.get("age")), u.get("email"));\n    }\n    System.out.println(tx.exec());\n}`,
      create: () =>
        `try (AbstractTransaction tx = jedis.multi()) {\n    tx.hset("user:${NEW_USER.email}", Map.of("name", "${NEW_USER.name}", "email", "${NEW_USER.email}", "age", "${NEW_USER.age}"));\n    tx.zadd("users:by_age", ${NEW_USER.age}, "${NEW_USER.email}");\n    tx.exec();\n}\nSystem.out.println("created ${NEW_USER.email}");`,
      read: () =>
        `List<String> emails = jedis.zrangeByScore("users:by_age", ${READ_MIN_AGE}, Double.POSITIVE_INFINITY);\nfor (String email : emails) {\n    System.out.println(jedis.hgetAll("user:" + email));\n}`,
      update: () =>
        `try (AbstractTransaction tx = jedis.multi()) {\n    tx.hset("user:${U.email}", "age", "${U.age}");\n    tx.zadd("users:by_age", ${U.age}, "${U.email}");\n    System.out.println(tx.exec());\n}`,
      delete: () =>
        `try (AbstractTransaction tx = jedis.multi()) {\n    tx.del("user:${DELETE_EMAIL}");\n    tx.zrem("users:by_age", "${DELETE_EMAIL}");\n    System.out.println(tx.exec()); // [keys deleted, members removed]\n}`,
    },
  },

  csharp: {
    driver: 'StackExchange.Redis',
    install: 'dotnet add package StackExchange.Redis',
    wrap: (c, body) => `using StackExchange.Redis;

var redis = await ConnectionMultiplexer.ConnectAsync("${c.host}:${c.port}${c.password ? `,user=${c.user || 'default'},password=${c.password}` : ''}");
var db = redis.GetDatabase(${c.database || 0});

${body}

await redis.CloseAsync();
`,
    ops: {
      connect: () => `var latency = await db.PingAsync();\nConsole.WriteLine($"PONG in {latency.TotalMilliseconds} ms");`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '// ')}\nawait db.StringSetAsync("app:schema_version", 1);`,
      seed: () =>
        `var sample = new[]\n{\n${SAMPLE_USERS.map((u) => `    (Name: "${u.name}", Email: "${u.email}", Age: ${u.age}),`).join('\n')}\n};\n\n// MULTI/EXEC: queued commands are sent together and applied atomically\nvar tx = db.CreateTransaction();\nforeach (var u in sample)\n{\n    _ = tx.HashSetAsync($"user:{u.Email}", new HashEntry[] { new("name", u.Name), new("email", u.Email), new("age", u.Age) });\n    _ = tx.SortedSetAddAsync("users:by_age", u.Email, u.Age);\n}\nConsole.WriteLine($"committed: {await tx.ExecuteAsync()}");`,
      create: () =>
        `var tx = db.CreateTransaction();\n_ = tx.HashSetAsync("user:${NEW_USER.email}", new HashEntry[]\n{\n    new("name", "${NEW_USER.name}"), new("email", "${NEW_USER.email}"), new("age", ${NEW_USER.age}),\n});\n_ = tx.SortedSetAddAsync("users:by_age", "${NEW_USER.email}", ${NEW_USER.age});\nConsole.WriteLine($"committed: {await tx.ExecuteAsync()}");`,
      read: () =>
        `var emails = await db.SortedSetRangeByScoreAsync("users:by_age", ${READ_MIN_AGE}, double.PositiveInfinity);\nforeach (var email in emails)\n{\n    var hash = await db.HashGetAllAsync($"user:{email}");\n    Console.WriteLine(string.Join(", ", hash.Select(h => $"{h.Name}={h.Value}")));\n}`,
      update: () =>
        `var tx = db.CreateTransaction();\n_ = tx.HashSetAsync("user:${U.email}", "age", ${U.age});\n_ = tx.SortedSetAddAsync("users:by_age", "${U.email}", ${U.age});\nConsole.WriteLine($"committed: {await tx.ExecuteAsync()}");`,
      delete: () =>
        `var tx = db.CreateTransaction();\n_ = tx.KeyDeleteAsync("user:${DELETE_EMAIL}");\n_ = tx.SortedSetRemoveAsync("users:by_age", "${DELETE_EMAIL}");\nConsole.WriteLine($"committed: {await tx.ExecuteAsync()}");`,
    },
  },

  php: {
    driver: 'Predis',
    install: 'composer require predis/predis',
    wrap: (c, body) => `<?php
require __DIR__ . '/vendor/autoload.php';

$redis = new Predis\\Client('${url(c)}');

${body}
`,
    ops: {
      connect: () => `echo $redis->ping(), "\\n"; // PONG\n$info = $redis->info('server');\necho 'Redis ', $info['Server']['redis_version'], "\\n";`,
      schema: () => `${KEYS_DOC.replace(/^/gm, '// ')}\n$redis->set('app:schema_version', 1);`,
      seed: () =>
        `$sample = ${objLit('php', SAMPLE_USERS)};\n\n// MULTI/EXEC: one round trip, applied atomically\n$replies = $redis->transaction(function ($tx) use ($sample) {\n    foreach ($sample as $u) {\n        $tx->hmset("user:{$u['email']}", $u);\n        $tx->zadd('users:by_age', [$u['email'] => $u['age']]);\n    }\n});\nprint_r($replies);`,
      create: () =>
        `$user = ${objLit('php', NEW_USER)};\n$redis->transaction(function ($tx) use ($user) {\n    $tx->hmset("user:{$user['email']}", $user);\n    $tx->zadd('users:by_age', [$user['email'] => $user['age']]);\n});\necho "created {$user['email']}\\n";`,
      read: () =>
        `$emails = $redis->zrangebyscore('users:by_age', ${READ_MIN_AGE}, '+inf');\nforeach ($emails as $email) {\n    print_r($redis->hgetall("user:$email"));\n}`,
      update: () =>
        `$replies = $redis->transaction(function ($tx) {\n    $tx->hset('user:${U.email}', 'age', ${U.age});\n    $tx->zadd('users:by_age', ['${U.email}' => ${U.age}]);\n});\nprint_r($replies);`,
      delete: () =>
        `$replies = $redis->transaction(function ($tx) {\n    $tx->del('user:${DELETE_EMAIL}');\n    $tx->zrem('users:by_age', '${DELETE_EMAIL}');\n});\nprint_r($replies); // [keys deleted, members removed]`,
    },
  },
};
