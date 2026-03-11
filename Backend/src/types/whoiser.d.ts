declare module 'whoiser' {
  export interface WhoisOptions {
    follow?: number;
    timeout?: number;
    raw?: boolean;
  }

  type WhoisQuery = (query: string, options?: WhoisOptions) => Promise<unknown>;

  interface WhoisModule {
    (query: string, options?: WhoisOptions): Promise<unknown>;
    domain: WhoisQuery;
    ip: WhoisQuery;
    asn: WhoisQuery;
  }

  const whoiser: WhoisModule;
  export default whoiser;
}
