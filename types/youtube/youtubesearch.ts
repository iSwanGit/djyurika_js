import { Item } from "./item";
import { PageInfo } from "./pageinfo";

export type YoutubeSearch = {
  kind: string;
  etag: string;
  nextPageToken: string;
  regionCode: string;
  pageInfo: PageInfo;
  items: Array<Item>;
}
