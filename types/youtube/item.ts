import { ID } from "./id";
import { Snippet } from "./snippet";

export type Item = {
  kind: string;
  etag: string;
  id: ID;
  snippet: Snippet;
}
