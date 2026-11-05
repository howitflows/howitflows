import type { ConnConfig } from '../types';
import { ApiDb, goBody } from './api';
import { indent, objLit, goImports, SAMPLE_USERS, NEW_USER, READ_MIN_AGE, UPDATE_USER, DELETE_EMAIL } from './util';

const uri = (c: ConnConfig) =>
  c.user ? `mongodb://${c.user}:${c.password}@${c.host}:${c.port}/?authSource=admin` : `mongodb://${c.host}:${c.port}`;

const SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'email'],
    properties: {
      name: { bsonType: 'string' },
      email: { bsonType: 'string', pattern: '^.+@.+$' },
      age: { bsonType: 'number', minimum: 0 },
    },
  },
};
const schemaJson = JSON.stringify(SCHEMA, null, 2);
const U = UPDATE_USER;

export const MONGO: ApiDb = {
  native: {
    driver: 'mongosh',
    install: 'brew install mongosh   # or download from mongodb.com/try/download/shell',
    hl: 'javascript',
    file: 'script.js',
    wrap: (c, body) => `// Run with:\n//   mongosh "${uri(c)}" script.js\n\ndb = db.getSiblingDB('${c.database}');\n\n${body}\n`,
    ops: {
      connect: () => `printjson(db.runCommand({ ping: 1 }));\nprint('MongoDB', db.version());`,
      schema: () =>
        `// Collections are created lazily, but a validator enforces a minimal shape\nif (!db.getCollectionNames().includes('users')) {\n  db.createCollection('users', {\n    validator: ${objLit('node', SCHEMA, 4)},\n  });\n}\ndb.users.createIndex({ email: 1 }, { unique: true });\ndb.users.createIndex({ age: 1 });`,
      seed: () =>
        `// Upsert by email so the script is safe to re-run\nconst users = ${objLit('node', SAMPLE_USERS)};\nconst res = db.users.bulkWrite(\n  users.map((u) => ({ updateOne: { filter: { email: u.email }, update: { $set: u }, upsert: true } })),\n);\nprintjson(res);`,
      create: () => `const { insertedId } = db.users.insertOne({ ...${objLit('node', NEW_USER)}, createdAt: new Date() });\nprint('inserted', insertedId);`,
      read: () => `db.users\n  .find({ age: { $gte: ${READ_MIN_AGE} } }, { _id: 0, name: 1, email: 1, age: 1 })\n  .sort({ age: -1 })\n  .forEach((doc) => printjson(doc));`,
      update: () => `const res = db.users.updateOne({ email: '${U.email}' }, { $set: { age: ${U.age} } });\nprint(res.matchedCount, 'matched,', res.modifiedCount, 'modified');`,
      delete: () => `const res = db.users.deleteOne({ email: '${DELETE_EMAIL}' });\nprint(res.deletedCount, 'deleted');`,
    },
  },

  python: {
    driver: 'PyMongo',
    install: 'pip install pymongo',
    wrap: (c, body) => `from datetime import datetime, timezone

from pymongo import ASCENDING, MongoClient, UpdateOne
from pymongo.errors import CollectionInvalid

client = MongoClient("${uri(c)}")
db = client["${c.database}"]
users = db["users"]

try:
${indent(body, 4)}
finally:
    client.close()
`,
    ops: {
      connect: () => `print(client.admin.command("ping"))\nprint("MongoDB", client.server_info()["version"])`,
      schema: () =>
        `try:\n    db.create_collection("users", validator=${objLit('python', SCHEMA, 4)})\nexcept CollectionInvalid:\n    pass  # already exists\n\nusers.create_index([("email", ASCENDING)], unique=True)\nusers.create_index("age")`,
      seed: () =>
        `sample = ${objLit('python', SAMPLE_USERS)}\n# Upsert by email so the script is safe to re-run\nresult = users.bulk_write([\n    UpdateOne({"email": u["email"]}, {"$set": u}, upsert=True) for u in sample\n])\nprint(result.bulk_api_result)`,
      create: () =>
        `doc = {${Object.entries(NEW_USER)
          .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
          .join(', ')}, "createdAt": datetime.now(timezone.utc)}\nresult = users.insert_one(doc)\nprint("inserted", result.inserted_id)`,
      read: () =>
        `cursor = users.find({"age": {"$gte": ${READ_MIN_AGE}}}, {"_id": 0}).sort("age", -1)\nfor doc in cursor:\n    print(doc)`,
      update: () =>
        `result = users.update_one({"email": "${U.email}"}, {"$set": {"age": ${U.age}}})\nprint(result.matched_count, "matched,", result.modified_count, "modified")`,
      delete: () => `result = users.delete_one({"email": "${DELETE_EMAIL}"})\nprint(result.deleted_count, "deleted")`,
    },
  },

  node: {
    driver: 'mongodb (official)',
    install: 'npm install mongodb',
    wrap: (c, body) => `import { MongoClient } from 'mongodb';

const client = new MongoClient('${uri(c)}');
await client.connect();
const db = client.db('${c.database}');
const users = db.collection('users');

try {
${indent(body, 2)}
} finally {
  await client.close();
}
`,
    ops: {
      connect: () => `await db.command({ ping: 1 });\nconst info = await db.admin().buildInfo();\nconsole.log('MongoDB', info.version);`,
      schema: () =>
        `await db\n  .createCollection('users', {\n    validator: ${objLit('node', SCHEMA, 4)},\n  })\n  .catch((err) => {\n    if (err.codeName !== 'NamespaceExists') throw err;\n  });\n\nawait users.createIndex({ email: 1 }, { unique: true });\nawait users.createIndex({ age: 1 });`,
      seed: () =>
        `const sample = ${objLit('node', SAMPLE_USERS)};\n// Upsert by email so the script is safe to re-run\nconst result = await users.bulkWrite(\n  sample.map((u) => ({ updateOne: { filter: { email: u.email }, update: { $set: u }, upsert: true } })),\n);\nconsole.log(result.upsertedCount, 'inserted,', result.modifiedCount, 'updated');`,
      create: () =>
        `const { insertedId } = await users.insertOne({ ...${objLit('node', NEW_USER)}, createdAt: new Date() });\nconsole.log('inserted', insertedId);`,
      read: () =>
        `const docs = await users\n  .find({ age: { $gte: ${READ_MIN_AGE} } }, { projection: { _id: 0 } })\n  .sort({ age: -1 })\n  .toArray();\nconsole.table(docs);`,
      update: () =>
        `const res = await users.updateOne({ email: '${U.email}' }, { $set: { age: ${U.age} } });\nconsole.log(res.matchedCount, 'matched,', res.modifiedCount, 'modified');`,
      delete: () => `const res = await users.deleteOne({ email: '${DELETE_EMAIL}' });\nconsole.log(res.deletedCount, 'deleted');`,
    },
  },

  go: {
    driver: 'mongo-go-driver v2',
    install: 'go get go.mongodb.org/mongo-driver/v2/mongo',
    wrap: (c, body) => {
      const main = `func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI("${uri(c)}"))
	if err != nil {
		log.Fatal(err)
	}
	defer client.Disconnect(ctx)
	db := client.Database("${c.database}")

${goBody(body)}
}
`;
      return `package main\n\n${goImports(
        main,
        ['context', 'fmt', 'log', 'time'],
        ['go.mongodb.org/mongo-driver/v2/bson', 'go.mongodb.org/mongo-driver/v2/mongo', 'go.mongodb.org/mongo-driver/v2/mongo/options'],
      )}\n\n${main}`;
    },
    ops: {
      connect: () =>
        `var info bson.M\nif err := db.RunCommand(ctx, bson.D{{Key: "buildInfo", Value: 1}}).Decode(&info); err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("MongoDB", info["version"])`,
      schema: () =>
        `validator := ${objLit('go', SCHEMA, 0)}\n// Returns a NamespaceExists error on re-runs, which is safe to ignore\n_ = db.CreateCollection(ctx, "users", options.CreateCollection().SetValidator(validator))\n\nnames, err := db.Collection("users").Indexes().CreateMany(ctx, []mongo.IndexModel{\n\t{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},\n\t{Keys: bson.D{{Key: "age", Value: 1}}},\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("indexes:", names)`,
      seed: () =>
        `users := db.Collection("users")\nsample := []bson.M{\n${SAMPLE_USERS.map((u) => `\t${objLit('go', u)},`).join('\n')}\n}\nfor _, u := range sample {\n\t// Upsert by email so the program is safe to re-run\n\t_, err := users.UpdateOne(ctx, bson.M{"email": u["email"]}, bson.M{"$set": u}, options.UpdateOne().SetUpsert(true))\n\tif err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\nfmt.Println(len(sample), "users upserted")`,
      create: () =>
        `doc := ${objLit('go', NEW_USER).replace(/}$/, ', "createdAt": time.Now()}')}\nres, err := db.Collection("users").InsertOne(ctx, doc)\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("inserted", res.InsertedID)`,
      read: () =>
        `opts := options.Find().\n\tSetSort(bson.D{{Key: "age", Value: -1}}).\n\tSetProjection(bson.M{"_id": 0})\ncur, err := db.Collection("users").Find(ctx, bson.M{"age": bson.M{"$gte": ${READ_MIN_AGE}}}, opts)\nif err != nil {\n\tlog.Fatal(err)\n}\nvar docs []bson.M\nif err := cur.All(ctx, &docs); err != nil {\n\tlog.Fatal(err)\n}\nfor _, d := range docs {\n\tfmt.Println(d)\n}`,
      update: () =>
        `res, err := db.Collection("users").UpdateOne(ctx,\n\tbson.M{"email": "${U.email}"},\n\tbson.M{"$set": bson.M{"age": ${U.age}}})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(res.MatchedCount, "matched,", res.ModifiedCount, "modified")`,
      delete: () =>
        `res, err := db.Collection("users").DeleteOne(ctx, bson.M{"email": "${DELETE_EMAIL}"})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(res.DeletedCount, "deleted")`,
    },
  },

  java: {
    driver: 'MongoDB Java Sync Driver',
    install: '<!-- Maven --> org.mongodb:mongodb-driver-sync:5.2.1',
    wrap: (c, body) => `import com.mongodb.MongoCommandException;
import com.mongodb.client.*;
import com.mongodb.client.model.*;
import java.util.Date;
import java.util.List;
import org.bson.Document;

public class App {
    public static void main(String[] args) {
        try (MongoClient client = MongoClients.create("${uri(c)}")) {
            MongoDatabase db = client.getDatabase("${c.database}");
            MongoCollection<Document> users = db.getCollection("users");

${indent(body, 12)}
        }
    }
}
`,
    ops: {
      connect: () => `Document info = db.runCommand(new Document("buildInfo", 1));\nSystem.out.println("MongoDB " + info.getString("version"));`,
      schema: () =>
        `Document validator = Document.parse("""\n${indent(schemaJson, 8)}\n        """);\ntry {\n    db.createCollection("users", new CreateCollectionOptions()\n            .validationOptions(new ValidationOptions().validator(validator)));\n} catch (MongoCommandException e) {\n    // NamespaceExists: already created\n}\nusers.createIndex(Indexes.ascending("email"), new IndexOptions().unique(true));\nusers.createIndex(Indexes.ascending("age"));`,
      seed: () =>
        `List<Document> sample = List.of(\n${SAMPLE_USERS.map((u) => `        new Document("name", "${u.name}").append("email", "${u.email}").append("age", ${u.age})`).join(',\n')});\n// Upsert by email so the program is safe to re-run\nfor (Document u : sample) {\n    users.replaceOne(Filters.eq("email", u.getString("email")), u, new ReplaceOptions().upsert(true));\n}\nSystem.out.println(sample.size() + " users upserted");`,
      create: () =>
        `var result = users.insertOne(new Document("name", "${NEW_USER.name}")\n        .append("email", "${NEW_USER.email}")\n        .append("age", ${NEW_USER.age})\n        .append("createdAt", new Date()));\nSystem.out.println("inserted " + result.getInsertedId());`,
      read: () =>
        `for (Document d : users.find(Filters.gte("age", ${READ_MIN_AGE}))\n        .projection(Projections.excludeId())\n        .sort(Sorts.descending("age"))) {\n    System.out.println(d.toJson());\n}`,
      update: () =>
        `var result = users.updateOne(Filters.eq("email", "${U.email}"), Updates.set("age", ${U.age}));\nSystem.out.println(result.getMatchedCount() + " matched, " + result.getModifiedCount() + " modified");`,
      delete: () => `var result = users.deleteOne(Filters.eq("email", "${DELETE_EMAIL}"));\nSystem.out.println(result.getDeletedCount() + " deleted");`,
    },
  },

  csharp: {
    driver: 'MongoDB.Driver',
    install: 'dotnet add package MongoDB.Driver',
    wrap: (c, body) => `using MongoDB.Bson;
using MongoDB.Driver;

var client = new MongoClient("${uri(c)}");
var db = client.GetDatabase("${c.database}");
var users = db.GetCollection<BsonDocument>("users");

${body}
`,
    ops: {
      connect: () =>
        `var info = await db.RunCommandAsync<BsonDocument>(new BsonDocument("buildInfo", 1));\nConsole.WriteLine($"MongoDB {info["version"]}");`,
      schema: () =>
        `var validator = BsonDocument.Parse("""\n${indent(schemaJson, 4)}\n    """);\ntry\n{\n    await db.CreateCollectionAsync("users", new CreateCollectionOptions<BsonDocument> { Validator = validator });\n}\ncatch (MongoCommandException)\n{\n    // NamespaceExists: already created\n}\nawait users.Indexes.CreateManyAsync(new[]\n{\n    new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("email"), new CreateIndexOptions { Unique = true }),\n    new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("age")),\n});`,
      seed: () =>
        `var sample = new[]\n{\n${SAMPLE_USERS.map((u) => `    new BsonDocument { { "name", "${u.name}" }, { "email", "${u.email}" }, { "age", ${u.age} } },`).join('\n')}\n};\n// Upsert by email so the program is safe to re-run\nforeach (var u in sample)\n{\n    await users.ReplaceOneAsync(Builders<BsonDocument>.Filter.Eq("email", u["email"]), u, new ReplaceOptions { IsUpsert = true });\n}\nConsole.WriteLine($"{sample.Length} users upserted");`,
      create: () =>
        `var doc = new BsonDocument\n{\n    { "name", "${NEW_USER.name}" },\n    { "email", "${NEW_USER.email}" },\n    { "age", ${NEW_USER.age} },\n    { "createdAt", DateTime.UtcNow },\n};\nawait users.InsertOneAsync(doc);\nConsole.WriteLine($"inserted {doc["_id"]}");`,
      read: () =>
        `var docs = await users\n    .Find(Builders<BsonDocument>.Filter.Gte("age", ${READ_MIN_AGE}))\n    .Project(Builders<BsonDocument>.Projection.Exclude("_id"))\n    .Sort(Builders<BsonDocument>.Sort.Descending("age"))\n    .ToListAsync();\ndocs.ForEach(d => Console.WriteLine(d));`,
      update: () =>
        `var result = await users.UpdateOneAsync(\n    Builders<BsonDocument>.Filter.Eq("email", "${U.email}"),\n    Builders<BsonDocument>.Update.Set("age", ${U.age}));\nConsole.WriteLine($"{result.MatchedCount} matched, {result.ModifiedCount} modified");`,
      delete: () =>
        `var result = await users.DeleteOneAsync(Builders<BsonDocument>.Filter.Eq("email", "${DELETE_EMAIL}"));\nConsole.WriteLine($"{result.DeletedCount} deleted");`,
    },
  },

  php: {
    driver: 'mongodb/mongodb',
    install: 'pecl install mongodb && composer require mongodb/mongodb',
    wrap: (c, body) => `<?php
require __DIR__ . '/vendor/autoload.php';

$client = new MongoDB\\Client('${uri(c)}');
$db = $client->selectDatabase('${c.database}');
$users = $db->selectCollection('users');

${body}
`,
    ops: {
      connect: () => `$info = $db->command(['buildInfo' => 1])->toArray()[0];\necho "MongoDB {$info['version']}\\n";`,
      schema: () =>
        `try {\n    $db->createCollection('users', ['validator' => ${objLit('php', SCHEMA, 4)}]);\n} catch (MongoDB\\Driver\\Exception\\CommandException $e) {\n    // NamespaceExists: already created\n}\n$users->createIndex(['email' => 1], ['unique' => true]);\n$users->createIndex(['age' => 1]);`,
      seed: () =>
        `$sample = ${objLit('php', SAMPLE_USERS)};\n// Upsert by email so the script is safe to re-run\nforeach ($sample as $u) {\n    $users->updateOne(['email' => $u['email']], ['$set' => $u], ['upsert' => true]);\n}\necho count($sample) . " users upserted\\n";`,
      create: () =>
        `$result = $users->insertOne(${objLit('php', NEW_USER).replace(/]$/, ", 'createdAt' => new MongoDB\\BSON\\UTCDateTime()]")});\necho "inserted {$result->getInsertedId()}\\n";`,
      read: () =>
        `$cursor = $users->find(\n    ['age' => ['$gte' => ${READ_MIN_AGE}]],\n    ['projection' => ['_id' => 0], 'sort' => ['age' => -1]],\n);\nforeach ($cursor as $doc) {\n    echo json_encode($doc), "\\n";\n}`,
      update: () =>
        `$result = $users->updateOne(['email' => '${U.email}'], ['$set' => ['age' => ${U.age}]]);\necho "{$result->getMatchedCount()} matched, {$result->getModifiedCount()} modified\\n";`,
      delete: () => `$result = $users->deleteOne(['email' => '${DELETE_EMAIL}']);\necho "{$result->getDeletedCount()} deleted\\n";`,
    },
  },
};
