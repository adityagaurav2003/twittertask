import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPost } from "./mcp.tool.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0",
});

// Tool to add two numbers
server.tool(
  "addTwoNumbers",
  "Add two numbers",
  {
    a: z.number(), 
    b: z.number(),
  },
  async (arg) => {
    const { a, b } = arg;
    return {
      content: [
        {
          type: "text",
          text: `The sum of ${a} and ${b} is ${a + b}`,
        },
      ],
    };
  }
);

// Tool to create a post on Twitter (X)
server.tool(
  "createPost",
  "Create a post on Twitter",
  {
    status: z.string(),
  },
  async (arg) => {
    const { status } = arg;

    if (!status || status.trim() === "") {
      return {
        content: [
          {
            type: "text",
            text: "Error: The status message cannot be empty.",
          },
        ],
      };
    }

    // Only allow posts under a certain character limit (e.g., 280 characters)
    if (status.length > 280) {
      return {
        content: [
          {
            type: "text",
            text: "Error: The tweet exceeds the 280 character limit.",
          },
        ],
      };
    }

    return createPost(status); // Call the function that interacts with Twitter API
  }
);

const app = express();
const transports = {};

// SSE connection for sending real-time messages
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

// Handle incoming messages
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

app.listen(3001, () => {
  console.log("Server is running on http://localhost:3001");
});
