// Type declarations for Deno Edge Functions
// This file helps the IDE understand Deno-specific APIs

declare global {
    const Deno: {
        serve: (handler: (req: Request) => Response | Promise<Response>) => void;
        env: {
            get: (key: string) => string | undefined;
        };
    };
}

// Allow npm: specifier imports
declare module "npm:@google/genai@^1.38.0" {
    export class GoogleGenAI {
        constructor(config: { apiKey: string });
        models: {
            generateContent: (options: {
                model: string;
                contents: {
                    parts: Array<
                        | { inlineData: { data: string; mimeType: string } }
                        | { text: string }
                    >;
                };
            }) => Promise<{
                text?: string;
                candidates?: Array<{
                    content?: {
                        parts?: Array<{
                            inlineData?: { data: string };
                            text?: string;
                        }>;
                    };
                }>;
            }>;
        };
    }
}

export { };
