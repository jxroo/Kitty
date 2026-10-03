// Regenerates the typed program client from the Anchor IDL:
//   cd packages/contracts && anchor build && cp targ../idl/kasa.json ../web/idl/
//   cd packages/web && npm run codama
import { readFileSync } from "node:fs";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const idl = JSON.parse(readFileSync(new URL("../idl/kasa.json", import.meta.url), "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));
await codama.accept(renderVisitor(".", { syncPackageJson: false }));
console.log("Client written to src/generated");
