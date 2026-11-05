import type { ArtIcon, Hue } from '@howitflows/art';

export interface Topic {
  id: string;
  title: string;
  blurb: string;
  examples: string[];
  art: ArtIcon;
  hue: Exclude<Hue, 'accent'>;
  /** Present once the explorer exists. */
  href?: string;
}

/** The hub catalogue. Add an entry here when you start a new explorer (see CONTRIBUTING.md). */
export const TOPICS: Topic[] = [
  {
    id: 'databases',
    title: 'Databases',
    blurb: 'Watch 10 databases connect, authenticate, query and replicate on the wire, then grab working code in 7 languages.',
    examples: ['PostgreSQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB'],
    art: 'disk',
    hue: 'blue',
    href: '/databases/postgres',
  },
  {
    id: 'streaming',
    title: 'Streaming',
    blurb: 'Producers, brokers, partitions and consumer groups: follow a record from send to commit, through acks and rebalances.',
    examples: ['Kafka', 'Pulsar', 'Kinesis', 'RabbitMQ'],
    art: 'cluster',
    hue: 'coral',
  },
  {
    id: 'cdc',
    title: 'Change data capture',
    blurb: 'A row changes in Postgres, and the change rides the WAL into Kafka and lands in your warehouse.',
    examples: ['Debezium', 'Kafka Connect'],
    art: 'replica',
    hue: 'green',
  },
  {
    id: 'query-engines',
    title: 'Query engines',
    blurb: 'SQL in, results out: parsing, planning, optimizing, stages and the shuffle, animated.',
    examples: ['Spark', 'Trino', 'DuckDB'],
    art: 'memory',
    hue: 'amber',
  },
  {
    id: 'lakehouse',
    title: 'Lakehouse formats',
    blurb: 'How a commit becomes snapshots, manifests and data files, and how time travel and compaction work.',
    examples: ['Iceberg', 'Delta Lake', 'Hudi'],
    art: 'disk',
    hue: 'teal',
  },
  {
    id: 'orchestration',
    title: 'Orchestration',
    blurb: 'Scheduler, executor and workers: watch a DAG run, retry and backfill.',
    examples: ['Airflow', 'Dagster', 'Prefect'],
    art: 'server',
    hue: 'violet',
  },
  {
    id: 'cloud-networking',
    title: 'Cloud networking',
    blurb: 'One request through DNS, load balancers, subnets, NAT and private endpoints, compared across clouds.',
    examples: ['AWS', 'GCP', 'Azure'],
    art: 'cloud',
    hue: 'blue',
  },
  {
    id: 'identity',
    title: 'Identity & auth',
    blurb: 'Token exchanges you can see: OAuth, OIDC, STS role assumption and workload identity.',
    examples: ['OAuth 2.0', 'OIDC', 'AWS STS'],
    art: 'client',
    hue: 'green',
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes',
    blurb: 'kubectl apply → API server → etcd → scheduler → kubelet: the life of a pod.',
    examples: ['Pods', 'Deployments', 'Services'],
    art: 'cluster',
    hue: 'teal',
  },
  {
    id: 'distributed',
    title: 'Distributed systems',
    blurb: 'Raft elections, quorums and consistent hashing. Kill a node and watch the cluster recover.',
    examples: ['Raft', 'Quorums', 'Hash rings'],
    art: 'server',
    hue: 'coral',
  },
];
