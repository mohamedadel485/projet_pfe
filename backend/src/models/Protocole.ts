export const Protocole = {
  http: "http",
  https: "https",
  ws: "ws",
  wss: "wss",
} as const;

export type Protocole = (typeof Protocole)[keyof typeof Protocole];

export default Protocole;
