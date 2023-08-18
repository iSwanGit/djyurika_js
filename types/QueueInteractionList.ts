import { APIMessage } from "discord-api-types";
import { Message } from "discord.js";

export interface QueueInteractionList {
  message: APIMessage | Message;
  currentPage: number;
}
