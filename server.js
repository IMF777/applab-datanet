require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { createCanvas } = require("canvas");

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

async function getFileData(id) {
  const filePath = `${BASE_PATH}${id}.json`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    const fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
    return { data: JSON.parse(fileContent), sha: response.data.sha };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { data: { messages: [], response: {} }, sha: null };
    }
    throw error;
  }
}

async function updateFile(id, content, message) {
  const filePath = `${BASE_PATH}${id}.json`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const encodedContent = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");

  const response = await axios.put(
    url,
    { message, content: encodedContent, sha: content.sha || undefined },
    { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
  );

  return response.data.content.html_url;
}

app.get("/message/write", async (req, res) => {
  const { id, message } = req.query;
  if (!id || !message) {
    return res.status(400).json({ error: "Missing 'id' or 'message' parameters" });
  }
  try {
    const { data, sha } = await getFileData(id);
    data.messages.push({ timestamp: new Date().toISOString(), message });
    const fileUrl = await updateFile(id, { ...data, sha }, `Updated ${id}.json with a new message`);
    res.json({ success: true, fileUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to write file", details: error.message });
  }
});

app.get("/http", async (req, res) => {
  const { url, method, headers, id, token } = req.query;
  if (!url || !id || !token) {
    return res.status(400).json({ error: "Missing 'url', 'id', or 'token' parameters" });
  }
  try {
    const response = await axios({ method, url, headers: JSON.parse(headers || "{}") });
    const { data, sha } = await getFileData(id);
    data.response = { token, data: response.data, timestamp: new Date().toISOString() };
    const fileUrl = await updateFile(id, { ...data, sha }, `Updated ${id}.json with new HTTP response`);
    res.json({ success: true, fileUrl });
  } catch (error) {
    res.status(500).json({ error: "HTTP request failed", details: error.message });
  }
});

// Function to convert JSON to an image
function jsonToImage(json) {
    const jsonString = JSON.stringify(json);
    const length = jsonString.length.toString().padStart(6, '0');
    const data = length + jsonString;
    console.log(data);
    
    const canvas = createCanvas(350, 450);
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(350, 450);
    
    for (let i = 0; i < data.length; i++) {
        const code = data.charCodeAt(i);
        const index = i * 4;
        imageData.data[index] = (code >> 16) & 255; // R
        imageData.data[index + 1] = (code >> 8) & 255; // G
        imageData.data[index + 2] = code & 255; // B
        imageData.data[index + 3] = 255; // Alpha
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toBuffer("image/png");
}

// Endpoint to fetch messages as an image
app.get("/image/messages", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send("Missing 'id' parameter");

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}${id}.json`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
    const messages = JSON.parse(fileContent);

    const imageBuffer = jsonToImage(messages);
    res.set("Content-Type", "image/png");
    res.send(imageBuffer);
  } catch (error) {
    res.status(500).send("Failed to fetch messages");
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

