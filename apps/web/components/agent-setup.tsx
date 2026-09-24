"use client";

import { useId, useState } from "react";
import { agentSetups } from "../lib/agent-setup";
import { CommandBlock } from "./command-block";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";

export function AgentSetup() {
  const id = useId();
  const [agent, setAgent] = useState<string>(agentSetups[0].id);
  const selected =
    agentSetups.find((item) => item.id === agent) ?? agentSetups[0];
  return (
    <div>
      <div className="filter-field">
        <label htmlFor={id}>Coding agent</label>
        <Select value={agent} onValueChange={setAgent}>
          <SelectTrigger id={id} aria-label="Coding agent">
            <span className="pm-select-value">{selected.name}</span>
          </SelectTrigger>
          <SelectContent>
            {agentSetups.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CommandBlock
        command={`pnpm dlx @promptmarket/cli setup ${agent} --write`}
        label={`Copy ${selected.name} setup`}
      />
      <p>
        Configures the hosted MCP server and workflow instructions for this
        project.
      </p>
      <p className="note">{selected.note}</p>
      <p>
        <a href="/docs/mcp">Manual configuration and other MCP clients</a>
      </p>
    </div>
  );
}
