export interface KnexConfig {
  client: string;
  connection: {
    host: string;
    port: number;
    user: string;
    database: string;
    password: string;
  };
  asyncStackTraces?: boolean;
  searchPath?: string[];
}
