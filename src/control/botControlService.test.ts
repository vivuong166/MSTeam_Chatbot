import assert from "node:assert/strict";
import test from "node:test";
import { BotControlService } from "./botControlService";

class FakeBotControlStore {
  private state: { autoReply: boolean; updatedAt: string } | null = null;

  async get(): Promise<{ autoReply: boolean; updatedAt: string } | null> {
    return this.state;
  }

  async save(_botInstanceId: string, autoReply: boolean): Promise<{ autoReply: boolean; updatedAt: string }> {
    this.state = { autoReply, updatedAt: new Date().toISOString() };
    return this.state;
  }
}

test("persists pause and resume state for one bot instance", async () => {
  const control = new BotControlService(true, new FakeBotControlStore(), "test-bot");

  assert.equal((await control.getStatus()).autoReply, true);
  assert.equal((await control.setAutoReply(false)).mode, "manual");
  assert.equal((await control.getStatus()).mode, "manual");
  assert.equal((await control.setAutoReply(true)).mode, "automatic");
});
