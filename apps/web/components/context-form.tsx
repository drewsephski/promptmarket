"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowMark } from "./marks";
import { FilterSelect } from "./filter-select";
import {
  CONTEXT_FILTERS,
  contextSearchParams,
  type ContextFilters,
} from "../lib/context-query";

interface ContextFormProps {
  query: string;
  filters: ContextFilters;
}

function filtersOpen(filters: ContextFilters): boolean {
  return Object.values(filters).some(function set(value) {
    return value.length > 0;
  });
}

export function ContextForm({ query, filters }: ContextFormProps) {
  const router = useRouter();
  const [contextOpen, setContextOpen] = useState(filtersOpen(filters));

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextQuery = String(data.get("q") ?? "");
    const nextFilters: ContextFilters = {
      framework: String(data.get("framework") ?? ""),
      ai: String(data.get("ai") ?? ""),
      provider: String(data.get("provider") ?? ""),
      database: String(data.get("database") ?? ""),
      orm: String(data.get("orm") ?? ""),
    };
    router.push(contextSearchParams(nextQuery, nextFilters));
  }

  return (
    <form className="filters context-filters" role="search" onSubmit={handleSubmit}>
      <label className="filter-field">
        <span>What are you building?</span>
        <input
          name="q"
          defaultValue={query}
          placeholder="Add RAG over internal documentation to a Next.js app using Neon"
          aria-label="What are you building?"
        />
      </label>
      <div className="resolver-actions">
        <button className="pill" type="submit">
          <span>Resolve</span>
          <span className="pill-mark" aria-hidden="true">
            <ArrowMark />
          </span>
        </button>
        <button
          type="button"
          className="text-action"
          aria-expanded={contextOpen}
          aria-controls="project-context"
          onClick={function handleToggleContext() {
            setContextOpen(function toggle(current) {
              return !current;
            });
          }}
        >
          {contextOpen ? "Hide project context" : "Add project context"}
        </button>
      </div>
      {contextOpen ? (
        <div className="context-filter-row" id="project-context">
          <FilterSelect
            name="framework"
            label="Framework"
            value={filters.framework}
            emptyLabel="Any"
            options={[...CONTEXT_FILTERS.framework]}
          />
          <FilterSelect
            name="ai"
            label="AI"
            value={filters.ai}
            emptyLabel="Any"
            options={[...CONTEXT_FILTERS.ai]}
          />
          <FilterSelect
            name="provider"
            label="Provider"
            value={filters.provider}
            emptyLabel="Any"
            options={[...CONTEXT_FILTERS.provider]}
          />
          <FilterSelect
            name="database"
            label="Database"
            value={filters.database}
            emptyLabel="Any"
            options={[...CONTEXT_FILTERS.database]}
          />
          <FilterSelect
            name="orm"
            label="ORM"
            value={filters.orm}
            emptyLabel="Any"
            options={[...CONTEXT_FILTERS.orm]}
          />
        </div>
      ) : null}
    </form>
  );
}
