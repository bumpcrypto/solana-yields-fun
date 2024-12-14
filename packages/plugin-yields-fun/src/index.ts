import { Plugin } from "@ai16z/eliza";
import { raydiumProvider } from "./providers/raydiumProvider";
import { marinadeProvider } from "./providers/marinadeProvider";
import { lidoProvider } from "./providers/lidoProvider";
import { jpoolProvider } from "./providers/jpoolProvider";
import { luloProvider } from "./providers/luloProvider";
import { depositAction, withdrawAction } from "./actions/luloActions";

// Import providers, actions, and evaluators as they are created
// export * from "./providers/token";
// export * from "./evaluators/yield";
// export * from "./actions/stake";

export const yieldsFunPlugin: Plugin = {
    name: "yields-fun",
    description: "Yields Fun Plugin for Eliza",
    actions: [depositAction, withdrawAction],
    evaluators: [
        // Add evaluators here
    ],
    providers: [
        raydiumProvider,
        marinadeProvider,
        lidoProvider,
        jpoolProvider,
        luloProvider,
    ],
};

export default yieldsFunPlugin;
