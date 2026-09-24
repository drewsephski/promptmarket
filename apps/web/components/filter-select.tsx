"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowMark } from "./marks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "./ui/select";

const ANY = "__any";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  name: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: FilterOption[];
}

export function FilterSelect({
  name,
  label,
  value,
  emptyLabel,
  options,
}: FilterSelectProps) {
  const [selected, setSelected] = useState(value || ANY);
  const fieldId = `${name}-filter`;
  const current = options.find(function match(option) {
    return option.value === selected;
  });
  const shown = current?.label ?? emptyLabel;

  return (
    <div className="filter-field">
      <label htmlFor={fieldId}>{label}</label>
      {selected === ANY ? null : (
        <input type="hidden" name={name} value={selected} />
      )}
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger id={fieldId} aria-label={label}>
          <span className="pm-select-value">{shown}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{emptyLabel}</SelectItem>
          {options.map(function renderOption(option) {
            return (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

interface PromptFiltersProps {
  query: string;
  category: string;
  kind: string;
  difficulty: string;
  categories: FilterOption[];
}

export function PromptFilters({
  query,
  category,
  kind,
  difficulty,
  categories,
}: PromptFiltersProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    const next = params.toString();
    router.push(next ? `/prompts?${next}` : "/prompts");
  }

  return (
    <form className="filters" role="search" onSubmit={handleSubmit}>
      <label className="filter-field">
        <span>Search</span>
        <input
          name="q"
          defaultValue={query}
          placeholder="structured output, RAG, triage"
        />
      </label>
      <FilterSelect
        name="category"
        label="Category"
        value={category}
        emptyLabel="All"
        options={categories}
      />
      <FilterSelect
        name="kind"
        label="Type"
        value={kind}
        emptyLabel="Prompts and skills"
        options={[
          { value: "prompt", label: "Prompts" },
          { value: "skill", label: "Skills" },
        ]}
      />
      <FilterSelect
        name="difficulty"
        label="Difficulty"
        value={difficulty}
        emptyLabel="Any"
        options={[
          { value: "beginner", label: "Beginner" },
          { value: "intermediate", label: "Intermediate" },
          { value: "advanced", label: "Advanced" },
        ]}
      />
      <button className="pill" type="submit">
        <span>Apply</span>
        <span className="pill-mark" aria-hidden="true">
          <ArrowMark />
        </span>
      </button>
    </form>
  );
}
