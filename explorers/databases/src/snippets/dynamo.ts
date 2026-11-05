import type { ConnConfig } from '../types';
import { ApiDb, goBody } from './api';
import { indent, objLit, goImports, SAMPLE_USERS, NEW_USER, READ_MIN_AGE, UPDATE_USER, DELETE_EMAIL } from './util';

// For DynamoDB the connection fields map to: user = access key id, password = secret key, database = region.
const ep = (c: ConnConfig) => `http://${c.host}:${c.port}`;
const T = 'Users';
const U = UPDATE_USER;

const av = (v: string | number) => (typeof v === 'number' ? { N: String(v) } : { S: v });
const avItem = (o: Record<string, string | number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, av(v)]));

export const DYNAMO: ApiDb = {
  native: {
    driver: 'AWS CLI v2',
    install: 'brew install awscli   # or: winget install Amazon.AWSCLI',
    hl: 'bash',
    file: 'requests.sh',
    wrap: (c, body) =>
      `export AWS_ACCESS_KEY_ID=${c.user} AWS_SECRET_ACCESS_KEY=${c.password} AWS_DEFAULT_REGION=${c.database}\nEP="--endpoint-url ${ep(c)}"   # drop this to talk to real AWS\n\n${body}\n`,
    ops: {
      connect: () => `aws dynamodb list-tables $EP`,
      schema: () =>
        `aws dynamodb create-table $EP \\\n  --table-name ${T} \\\n  --attribute-definitions AttributeName=email,AttributeType=S \\\n  --key-schema AttributeName=email,KeyType=HASH \\\n  --billing-mode PAY_PER_REQUEST\n\naws dynamodb wait table-exists $EP --table-name ${T}`,
      seed: () =>
        `aws dynamodb batch-write-item $EP --request-items '${JSON.stringify({ [T]: SAMPLE_USERS.map((u) => ({ PutRequest: { Item: avItem(u) } })) }, null, 2)}'`,
      create: () =>
        `aws dynamodb put-item $EP --table-name ${T} \\\n  --item '${JSON.stringify(avItem(NEW_USER))}' \\\n  --condition-expression "attribute_not_exists(email)"`,
      read: () =>
        `# Scan reads the whole table then filters — fine for demos, use Query + an index in production\naws dynamodb scan $EP --table-name ${T} \\\n  --filter-expression "age >= :min" \\\n  --expression-attribute-values '{":min":{"N":"${READ_MIN_AGE}"}}'`,
      update: () =>
        `aws dynamodb update-item $EP --table-name ${T} \\\n  --key '{"email":{"S":"${U.email}"}}' \\\n  --update-expression "SET age = :age" \\\n  --expression-attribute-values '{":age":{"N":"${U.age}"}}' \\\n  --return-values UPDATED_NEW`,
      delete: () => `aws dynamodb delete-item $EP --table-name ${T} \\\n  --key '{"email":{"S":"${DELETE_EMAIL}"}}' \\\n  --return-values ALL_OLD`,
    },
  },

  python: {
    driver: 'boto3',
    install: 'pip install boto3',
    wrap: (c, body) => `import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url="${ep(c)}",  # drop this to talk to real AWS
    region_name="${c.database}",
    aws_access_key_id="${c.user}",
    aws_secret_access_key="${c.password}",
)
table = dynamodb.Table("${T}")

${body}
`,
    ops: {
      connect: () => `print([t.name for t in dynamodb.tables.all()])`,
      schema: () =>
        `try:\n    table = dynamodb.create_table(\n        TableName="${T}",\n        KeySchema=[{"AttributeName": "email", "KeyType": "HASH"}],\n        AttributeDefinitions=[{"AttributeName": "email", "AttributeType": "S"}],\n        BillingMode="PAY_PER_REQUEST",\n    )\n    table.wait_until_exists()\nexcept dynamodb.meta.client.exceptions.ResourceInUseException:\n    pass  # already exists\nprint(table.table_status)`,
      seed: () =>
        `sample = ${objLit('python', SAMPLE_USERS)}\n# batch_writer buffers puts into BatchWriteItem calls and retries unprocessed items\nwith table.batch_writer() as batch:\n    for u in sample:\n        batch.put_item(Item=u)\nprint(len(sample), "items written")`,
      create: () =>
        `table.put_item(\n    Item=${objLit('python', NEW_USER)},\n    ConditionExpression="attribute_not_exists(email)",  # don't overwrite\n)\nprint("created")`,
      read: () =>
        `# Scan reads the whole table then filters — fine for demos, use query() + an index in production\nresp = table.scan(FilterExpression=Attr("age").gte(${READ_MIN_AGE}))\nfor item in resp["Items"]:\n    print(item)`,
      update: () =>
        `resp = table.update_item(\n    Key={"email": "${U.email}"},\n    UpdateExpression="SET age = :age",\n    ExpressionAttributeValues={":age": ${U.age}},\n    ReturnValues="UPDATED_NEW",\n)\nprint(resp["Attributes"])`,
      delete: () => `resp = table.delete_item(Key={"email": "${DELETE_EMAIL}"}, ReturnValues="ALL_OLD")\nprint(resp.get("Attributes"))`,
    },
  },

  node: {
    driver: 'AWS SDK v3 (lib-dynamodb)',
    install: 'npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb',
    wrap: (c, body) => `import { CreateTableCommand, DynamoDBClient, ListTablesCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  endpoint: '${ep(c)}', // drop this to talk to real AWS
  region: '${c.database}',
  credentials: { accessKeyId: '${c.user}', secretAccessKey: '${c.password}' },
});
// The document client converts plain JS values <-> DynamoDB attribute values
const doc = DynamoDBDocumentClient.from(client);

${body}
`,
    ops: {
      connect: () => `const { TableNames } = await client.send(new ListTablesCommand({}));\nconsole.log(TableNames);`,
      schema: () =>
        `try {\n  await client.send(\n    new CreateTableCommand({\n      TableName: '${T}',\n      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],\n      AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],\n      BillingMode: 'PAY_PER_REQUEST',\n    }),\n  );\n} catch (err) {\n  if (err.name !== 'ResourceInUseException') throw err;\n}\nawait waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: '${T}' });\nconsole.log('table ready');`,
      seed: () =>
        `const sample = ${objLit('node', SAMPLE_USERS)};\nconst res = await doc.send(\n  new BatchWriteCommand({\n    RequestItems: { ${T}: sample.map((Item) => ({ PutRequest: { Item } })) },\n  }),\n);\nconsole.log('unprocessed:', res.UnprocessedItems);`,
      create: () =>
        `await doc.send(\n  new PutCommand({\n    TableName: '${T}',\n    Item: ${objLit('node', NEW_USER)},\n    ConditionExpression: 'attribute_not_exists(email)', // don't overwrite\n  }),\n);\nconsole.log('created');`,
      read: () =>
        `// Scan reads the whole table then filters — fine for demos, use Query + an index in production\nconst { Items } = await doc.send(\n  new ScanCommand({\n    TableName: '${T}',\n    FilterExpression: 'age >= :min',\n    ExpressionAttributeValues: { ':min': ${READ_MIN_AGE} },\n  }),\n);\nconsole.table(Items);`,
      update: () =>
        `const { Attributes } = await doc.send(\n  new UpdateCommand({\n    TableName: '${T}',\n    Key: { email: '${U.email}' },\n    UpdateExpression: 'SET age = :age',\n    ExpressionAttributeValues: { ':age': ${U.age} },\n    ReturnValues: 'UPDATED_NEW',\n  }),\n);\nconsole.log(Attributes);`,
      delete: () =>
        `const { Attributes } = await doc.send(\n  new DeleteCommand({ TableName: '${T}', Key: { email: '${DELETE_EMAIL}' }, ReturnValues: 'ALL_OLD' }),\n);\nconsole.log(Attributes);`,
    },
  },

  go: {
    driver: 'AWS SDK for Go v2',
    install: 'go get github.com/aws/aws-sdk-go-v2/config github.com/aws/aws-sdk-go-v2/service/dynamodb github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue',
    wrap: (c, body) => {
      const main = `type User struct {
	Email string \`dynamodbav:"email"\`
	Name  string \`dynamodbav:"name"\`
	Age   int    \`dynamodbav:"age"\`
}

func main() {
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("${c.database}"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("${c.user}", "${c.password}", "")),
	)
	if err != nil {
		log.Fatal(err)
	}
	client := dynamodb.NewFromConfig(cfg, func(o *dynamodb.Options) {
		o.BaseEndpoint = aws.String("${ep(c)}") // drop this to talk to real AWS
	})

${goBody(body)}
}
`;
      return `package main\n\n${goImports(
        main,
        ['context', 'errors', 'fmt', 'log'],
        [
          'github.com/aws/aws-sdk-go-v2/aws',
          'github.com/aws/aws-sdk-go-v2/config',
          'github.com/aws/aws-sdk-go-v2/credentials',
          'github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue',
          'github.com/aws/aws-sdk-go-v2/service/dynamodb',
          'github.com/aws/aws-sdk-go-v2/service/dynamodb/types',
        ],
      )}\n\n${main}`;
    },
    ops: {
      connect: () => `out, err := client.ListTables(ctx, &dynamodb.ListTablesInput{})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(out.TableNames)`,
      schema: () =>
        `_, err = client.CreateTable(ctx, &dynamodb.CreateTableInput{\n\tTableName:            aws.String("${T}"),\n\tAttributeDefinitions: []types.AttributeDefinition{{AttributeName: aws.String("email"), AttributeType: types.ScalarAttributeTypeS}},\n\tKeySchema:            []types.KeySchemaElement{{AttributeName: aws.String("email"), KeyType: types.KeyTypeHash}},\n\tBillingMode:          types.BillingModePayPerRequest,\n})\nvar inUse *types.ResourceInUseException\nif err != nil && !errors.As(err, &inUse) {\n\tlog.Fatal(err)\n}\nfmt.Println("table ready")`,
      seed: () =>
        `sample := []User{\n${SAMPLE_USERS.map((u) => `\t{Email: "${u.email}", Name: "${u.name}", Age: ${u.age}},`).join('\n')}\n}\nvar writes []types.WriteRequest\nfor _, u := range sample {\n\titem, err := attributevalue.MarshalMap(u)\n\tif err != nil {\n\t\tlog.Fatal(err)\n\t}\n\twrites = append(writes, types.WriteRequest{PutRequest: &types.PutRequest{Item: item}})\n}\nout, err := client.BatchWriteItem(ctx, &dynamodb.BatchWriteItemInput{\n\tRequestItems: map[string][]types.WriteRequest{"${T}": writes},\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("unprocessed:", len(out.UnprocessedItems))`,
      create: () =>
        `item, err := attributevalue.MarshalMap(User{Email: "${NEW_USER.email}", Name: "${NEW_USER.name}", Age: ${NEW_USER.age}})\nif err != nil {\n\tlog.Fatal(err)\n}\n_, err = client.PutItem(ctx, &dynamodb.PutItemInput{\n\tTableName:           aws.String("${T}"),\n\tItem:                item,\n\tConditionExpression: aws.String("attribute_not_exists(email)"), // don't overwrite\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println("created")`,
      read: () =>
        `// Scan reads the whole table then filters — fine for demos, use Query + an index in production\nout, err := client.Scan(ctx, &dynamodb.ScanInput{\n\tTableName:                 aws.String("${T}"),\n\tFilterExpression:          aws.String("age >= :min"),\n\tExpressionAttributeValues: map[string]types.AttributeValue{":min": &types.AttributeValueMemberN{Value: "${READ_MIN_AGE}"}},\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nvar users []User\nif err := attributevalue.UnmarshalListOfMaps(out.Items, &users); err != nil {\n\tlog.Fatal(err)\n}\nfor _, u := range users {\n\tfmt.Printf("%+v\\n", u)\n}`,
      update: () =>
        `out, err := client.UpdateItem(ctx, &dynamodb.UpdateItemInput{\n\tTableName:                 aws.String("${T}"),\n\tKey:                       map[string]types.AttributeValue{"email": &types.AttributeValueMemberS{Value: "${U.email}"}},\n\tUpdateExpression:          aws.String("SET age = :age"),\n\tExpressionAttributeValues: map[string]types.AttributeValue{":age": &types.AttributeValueMemberN{Value: "${U.age}"}},\n\tReturnValues:              types.ReturnValueUpdatedNew,\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(out.Attributes)`,
      delete: () =>
        `out, err := client.DeleteItem(ctx, &dynamodb.DeleteItemInput{\n\tTableName:    aws.String("${T}"),\n\tKey:          map[string]types.AttributeValue{"email": &types.AttributeValueMemberS{Value: "${DELETE_EMAIL}"}},\n\tReturnValues: types.ReturnValueAllOld,\n})\nif err != nil {\n\tlog.Fatal(err)\n}\nfmt.Println(out.Attributes)`,
    },
  },

  java: {
    driver: 'AWS SDK for Java v2',
    install: '<!-- Maven --> software.amazon.awssdk:dynamodb:2.29.20',
    wrap: (c, body) => `import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

public class App {
    static AttributeValue s(String v) { return AttributeValue.fromS(v); }
    static AttributeValue n(int v) { return AttributeValue.fromN(Integer.toString(v)); }

    public static void main(String[] args) {
        try (DynamoDbClient ddb = DynamoDbClient.builder()
                .endpointOverride(URI.create("${ep(c)}")) // drop this to talk to real AWS
                .region(Region.of("${c.database}"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("${c.user}", "${c.password}")))
                .build()) {
${indent(body, 12)}
        }
    }
}
`,
    ops: {
      connect: () => `System.out.println(ddb.listTables().tableNames());`,
      schema: () =>
        `try {\n    ddb.createTable(b -> b.tableName("${T}")\n            .attributeDefinitions(AttributeDefinition.builder().attributeName("email").attributeType(ScalarAttributeType.S).build())\n            .keySchema(KeySchemaElement.builder().attributeName("email").keyType(KeyType.HASH).build())\n            .billingMode(BillingMode.PAY_PER_REQUEST));\n    ddb.waiter().waitUntilTableExists(b -> b.tableName("${T}"));\n} catch (ResourceInUseException e) {\n    // already exists\n}\nSystem.out.println("table ready");`,
      seed: () =>
        `List<Map<String, AttributeValue>> sample = List.of(\n${SAMPLE_USERS.map((u) => `        Map.of("email", s("${u.email}"), "name", s("${u.name}"), "age", n(${u.age}))`).join(',\n')});\nList<WriteRequest> writes = new ArrayList<>();\nfor (var item : sample) {\n    writes.add(WriteRequest.builder().putRequest(p -> p.item(item)).build());\n}\nvar res = ddb.batchWriteItem(b -> b.requestItems(Map.of("${T}", writes)));\nSystem.out.println("unprocessed: " + res.unprocessedItems());`,
      create: () =>
        `ddb.putItem(b -> b.tableName("${T}")\n        .item(Map.of("email", s("${NEW_USER.email}"), "name", s("${NEW_USER.name}"), "age", n(${NEW_USER.age})))\n        .conditionExpression("attribute_not_exists(email)")); // don't overwrite\nSystem.out.println("created");`,
      read: () =>
        `// Scan reads the whole table then filters — fine for demos, use Query + an index in production\nvar res = ddb.scan(b -> b.tableName("${T}")\n        .filterExpression("age >= :min")\n        .expressionAttributeValues(Map.of(":min", n(${READ_MIN_AGE}))));\nres.items().forEach(System.out::println);`,
      update: () =>
        `var res = ddb.updateItem(b -> b.tableName("${T}")\n        .key(Map.of("email", s("${U.email}")))\n        .updateExpression("SET age = :age")\n        .expressionAttributeValues(Map.of(":age", n(${U.age})))\n        .returnValues(ReturnValue.UPDATED_NEW));\nSystem.out.println(res.attributes());`,
      delete: () =>
        `var res = ddb.deleteItem(b -> b.tableName("${T}")\n        .key(Map.of("email", s("${DELETE_EMAIL}")))\n        .returnValues(ReturnValue.ALL_OLD));\nSystem.out.println(res.attributes());`,
    },
  },

  csharp: {
    driver: 'AWSSDK.DynamoDBv2',
    install: 'dotnet add package AWSSDK.DynamoDBv2',
    wrap: (c, body) => `using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.Runtime;

var client = new AmazonDynamoDBClient(
    new BasicAWSCredentials("${c.user}", "${c.password}"),
    new AmazonDynamoDBConfig
    {
        ServiceURL = "${ep(c)}", // use RegionEndpoint instead for real AWS
        AuthenticationRegion = "${c.database}",
    });

static AttributeValue S(string v) => new() { S = v };
static AttributeValue N(int v) => new() { N = v.ToString() };

${body}
`,
    ops: {
      connect: () => `var tables = await client.ListTablesAsync(new ListTablesRequest());\nConsole.WriteLine(string.Join(", ", tables.TableNames));`,
      schema: () =>
        `try\n{\n    await client.CreateTableAsync(new CreateTableRequest\n    {\n        TableName = "${T}",\n        AttributeDefinitions = new List<AttributeDefinition> { new("email", ScalarAttributeType.S) },\n        KeySchema = new List<KeySchemaElement> { new("email", KeyType.HASH) },\n        BillingMode = BillingMode.PAY_PER_REQUEST,\n    });\n}\ncatch (ResourceInUseException)\n{\n    // already exists\n}\nConsole.WriteLine("table ready");`,
      seed: () =>
        `var sample = new[]\n{\n${SAMPLE_USERS.map((u) => `    new Dictionary<string, AttributeValue> { ["email"] = S("${u.email}"), ["name"] = S("${u.name}"), ["age"] = N(${u.age}) },`).join('\n')}\n};\nvar res = await client.BatchWriteItemAsync(new BatchWriteItemRequest\n{\n    RequestItems = new() { ["${T}"] = sample.Select(item => new WriteRequest(new PutRequest(item))).ToList() },\n});\nConsole.WriteLine($"unprocessed: {res.UnprocessedItems.Count}");`,
      create: () =>
        `await client.PutItemAsync(new PutItemRequest\n{\n    TableName = "${T}",\n    Item = new() { ["email"] = S("${NEW_USER.email}"), ["name"] = S("${NEW_USER.name}"), ["age"] = N(${NEW_USER.age}) },\n    ConditionExpression = "attribute_not_exists(email)", // don't overwrite\n});\nConsole.WriteLine("created");`,
      read: () =>
        `// Scan reads the whole table then filters — fine for demos, use Query + an index in production\nvar res = await client.ScanAsync(new ScanRequest\n{\n    TableName = "${T}",\n    FilterExpression = "age >= :min",\n    ExpressionAttributeValues = new() { [":min"] = N(${READ_MIN_AGE}) },\n});\nforeach (var item in res.Items)\n    Console.WriteLine(string.Join(", ", item.Select(kv => $"{kv.Key}={kv.Value.S ?? kv.Value.N}")));`,
      update: () =>
        `var res = await client.UpdateItemAsync(new UpdateItemRequest\n{\n    TableName = "${T}",\n    Key = new() { ["email"] = S("${U.email}") },\n    UpdateExpression = "SET age = :age",\n    ExpressionAttributeValues = new() { [":age"] = N(${U.age}) },\n    ReturnValues = ReturnValue.UPDATED_NEW,\n});\nConsole.WriteLine($"age is now {res.Attributes["age"].N}");`,
      delete: () =>
        `var res = await client.DeleteItemAsync(new DeleteItemRequest\n{\n    TableName = "${T}",\n    Key = new() { ["email"] = S("${DELETE_EMAIL}") },\n    ReturnValues = ReturnValue.ALL_OLD,\n});\nConsole.WriteLine($"deleted {res.Attributes.Count > 0}");`,
    },
  },

  php: {
    driver: 'AWS SDK for PHP',
    install: 'composer require aws/aws-sdk-php',
    wrap: (c, body) => `<?php
require __DIR__ . '/vendor/autoload.php';

use Aws\\DynamoDb\\DynamoDbClient;
use Aws\\DynamoDb\\Exception\\DynamoDbException;
use Aws\\DynamoDb\\Marshaler;

$client = new DynamoDbClient([
    'region'      => '${c.database}',
    'endpoint'    => '${ep(c)}', // drop this to talk to real AWS
    'credentials' => ['key' => '${c.user}', 'secret' => '${c.password}'],
]);
$m = new Marshaler(); // converts PHP arrays <-> DynamoDB attribute values

${body}
`,
    ops: {
      connect: () => `print_r($client->listTables()['TableNames']);`,
      schema: () =>
        `try {\n    $client->createTable([\n        'TableName'            => '${T}',\n        'AttributeDefinitions' => [['AttributeName' => 'email', 'AttributeType' => 'S']],\n        'KeySchema'            => [['AttributeName' => 'email', 'KeyType' => 'HASH']],\n        'BillingMode'          => 'PAY_PER_REQUEST',\n    ]);\n    $client->waitUntil('TableExists', ['TableName' => '${T}']);\n} catch (DynamoDbException $e) {\n    if ($e->getAwsErrorCode() !== 'ResourceInUseException') throw $e;\n}\necho "table ready\\n";`,
      seed: () =>
        `$sample = ${objLit('php', SAMPLE_USERS)};\n$res = $client->batchWriteItem(['RequestItems' => [\n    '${T}' => array_map(fn ($u) => ['PutRequest' => ['Item' => $m->marshalItem($u)]], $sample),\n]]);\nprint_r($res['UnprocessedItems']);`,
      create: () =>
        `$client->putItem([\n    'TableName'           => '${T}',\n    'Item'                => $m->marshalItem(${objLit('php', NEW_USER)}),\n    'ConditionExpression' => 'attribute_not_exists(email)', // don't overwrite\n]);\necho "created\\n";`,
      read: () =>
        `// Scan reads the whole table then filters — fine for demos, use query() + an index in production\n$res = $client->scan([\n    'TableName'                 => '${T}',\n    'FilterExpression'          => 'age >= :min',\n    'ExpressionAttributeValues' => $m->marshalItem([':min' => ${READ_MIN_AGE}]),\n]);\nforeach ($res['Items'] as $item) {\n    print_r($m->unmarshalItem($item));\n}`,
      update: () =>
        `$res = $client->updateItem([\n    'TableName'                 => '${T}',\n    'Key'                       => $m->marshalItem(['email' => '${U.email}']),\n    'UpdateExpression'          => 'SET age = :age',\n    'ExpressionAttributeValues' => $m->marshalItem([':age' => ${U.age}]),\n    'ReturnValues'              => 'UPDATED_NEW',\n]);\nprint_r($m->unmarshalItem($res['Attributes']));`,
      delete: () =>
        `$res = $client->deleteItem([\n    'TableName'    => '${T}',\n    'Key'          => $m->marshalItem(['email' => '${DELETE_EMAIL}']),\n    'ReturnValues' => 'ALL_OLD',\n]);\nprint_r($res['Attributes'] ?? []);`,
    },
  },
};
