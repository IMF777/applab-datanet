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

async function readFileFromGitHub(id) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}${id}.json`;
    try {
        const response = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
        return { content: JSON.parse(fileContent), sha: response.data.sha };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return { content: { messages: [], responses: [] }, sha: null };
        }
        throw error;
    }
}

async function writeFileToGitHub(id, content, sha, commitMessage) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BASE_PATH}${id}.json`;
    const encodedContent = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");

    const data = {
        message: commitMessage,
        content: encodedContent,
        sha: sha || undefined
    };

    return axios.put(url, data, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
}

app.get("/message/write", async (req, res) => {
    const { id, message } = req.query;
    if (!id || !message) return res.status(400).json({ error: "Missing 'id' or 'message' parameters" });

    try {
        const { content, sha } = await readFileFromGitHub(id);
        content.messages.push({ timestamp: new Date().toISOString(), message });
        const response = await writeFileToGitHub(id, content, sha, `Updated ${id}.json with a new message`);
        res.json({ success: true, fileUrl: response.data.content.html_url });
    } catch (error) {
        res.status(500).json({ error: "Failed to write file", details: error.response?.data || error.message });
    }
});

app.get("/http", async (req, res) => {
    const { id, url, method, headers, token } = req.body;
    if (!id || !url || !method) return res.status(400).json({ error: "Missing required parameters" });

    try {
        const httpResponse = await axios({ url, method, headers });
        const { content, sha } = await readFileFromGitHub(id);
        content.responses.push({ timestamp: new Date().toISOString(), response: httpResponse.data, token: token });
        const response = await writeFileToGitHub(id, content, sha, `Updated ${id}.json with a new HTTP response`);
        res.json({ success: true, fileUrl: response.data.content.html_url });
    } catch (error) {
        res.status(500).json({ error: "Failed to process HTTP request", details: error.response?.data || error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
