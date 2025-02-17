require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "IMF777";
const REPO = "applab-datanet";
const BASE_PATH = "datasets/inbox/";

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// /message/write endpoint (updated to handle new JSON structure)
app.get("/message/write", async (req, res) => {
  const { id, message } = req.query;

  if (!id || !message) {
    return res.status(400).json({ error: "Missing 'id' or 'message' parameters" });
  }

  const filePath = `${BASE_PATH}${id}.json`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

  try {
    let dataContent = { messages: [], responses: [] };
    let sha = null;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
      dataContent = JSON.parse(fileContent);
      sha = response.data.sha;
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        return res.status(500).json({ error: "Failed to read file" });
      }
    }

    // Push new message to messages array
    dataContent.messages.push({ timestamp: new Date().toISOString(), message });

    const encodedContent = Buffer.from(JSON.stringify(dataContent, null, 2)).toString("base64");
    const data = {
      message: `Updated ${filePath} with a new message`,
      content: encodedContent,
      sha: sha || undefined
    };

    const response = await axios.put(url, data, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    res.json({ success: true, fileUrl: response.data.content.html_url });
  } catch (error) {
    res.status(500).json({ error: "Failed to write file", details: error.response?.data || error.message });
  }
});

// /http endpoint (new)
app.get("/http", async (req, res) => {
  const { url, method, headers, id, token } = req.query;

  if (!url || !id) {
    return res.status(400).json({ error: "Missing 'url' or 'id' parameter" });
  }

  const filePath = `${BASE_PATH}${id}.json`;
  const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

  try {
    const response = await axios({
      url: decodeURIComponent(url),
      method: method || 'GET',
      headers: headers ? JSON.parse(decodeURIComponent(headers)) : {},
    });

    let dataContent = { messages: [], responses: [] };
    let sha = null;

    try {
      const fileResponse = await axios.get(githubUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const fileContent = Buffer.from(fileResponse.data.content, "base64").toString("utf-8");
      dataContent = JSON.parse(fileContent);
      sha = fileResponse.data.sha;
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        return res.status(500).json({ error: "Failed to read file" });
      }
    }

    // Add new HTTP response with token
    dataContent.responses.push({ timestamp: new Date().toISOString(), token, response: response.data });

    const encodedContent = Buffer.from(JSON.stringify(dataContent, null, 2)).toString("base64");
    const data = {
      message: `Updated ${filePath} with new HTTP response`,
      content: encodedContent,
      sha: sha || undefined
    };

    await axios.put(githubUrl, data, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    res.json({ success: true, message: "HTTP response saved to GitHub" });
  } catch (error) {
    res.status(500).json({ error: "Failed to make HTTP request", details: error.response?.data || error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
