export type SearchError = {
  code: number;
  message: string;
  errors: {
    message: string;
    domain: string;
    reason: string;
  };
}
