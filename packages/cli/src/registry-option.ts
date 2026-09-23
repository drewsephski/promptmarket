import {
  FileRegistry,
  RemoteRegistry,
  type Registry,
} from "@promptmarket/registry";

export type RegistryFlags = {
  recipes?: string;
  registry?: string;
};

export function createRegistry(options: RegistryFlags): Registry {
  if (options.recipes) {
    return new FileRegistry({ recipesDir: options.recipes });
  }
  if (options.registry) {
    return new RemoteRegistry(options.registry);
  }
  return new RemoteRegistry();
}
