require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "IMF777";  // Change to your username
const REPO = "applab-datanet";  // Change to your repo
const BASE_PATH = "datasets/inbox/";

// Middleware to parse JSON requests
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello, world!");
});

// Endpoint: /message/write?id=[applab_project_id]&message=[string]
app.get("/message/write", async (req, res) => {

    console.log(req.headers.origin);
    console.log(req.headers.referer);
    
    const { id, message } = req.query;

    if (!id || !message) {
        return res.status(400).json({ error: "Missing 'id' or 'message' parameters" });
    }

    const filePath = `${BASE_PATH}${id}.json`;
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

    try {
        // Get existing file data (if exists)
        let messages = [];
        let sha = null;

        try {
            const response = await axios.get(url, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });

            const fileContent = Buffer.from(response.data.content, "base64").toString("utf-8");
            messages = JSON.parse(fileContent);
            sha = response.data.sha; // Required for updating the file
        } catch (error) {
            if (error.response && error.response.status !== 404) {
                return res.status(500).json({ error: "Failed to read file" });
            }
        }

        // Append new message
        messages.push({ timestamp: new Date().toISOString(), message });

        // Encode updated content
        const encodedContent = Buffer.from(JSON.stringify(messages, null, 2)).toString("base64");

        // Prepare data for GitHub API
        const data = {
            message: `Updated ${filePath} with a new message`,
            content: encodedContent,
            sha: sha || undefined
        };

        // Write to GitHub
        const response = await axios.put(url, data, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });

        res.json({ success: true, fileUrl: response.data.content.html_url });
    } catch (error) {
        res.status(500).json({ error: "Failed to write file", details: error.response?.data || error.message });
    }
});

// New /http endpoint
app.get("/http", async (req, res) => {
    const { url, method = "GET", headers = {}, id } = req.body;

    if (!url || !id) {
        return res.status(400).json({ error: "Missing 'url' or 'id' parameter" });
    }

    try {
        const response = await axios({ url, method, headers });
        
        const filePath = `${BASE_PATH}${id}.json`;
        const githubUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;

        let messages = [];
        let sha = null;

        try {
            const fileResponse = await axios.get(githubUrl, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });
            const fileContent = Buffer.from(fileResponse.data.content, "base64").toString("utf-8");
            messages = JSON.parse(fileContent);
            sha = fileResponse.data.sha;
        } catch (err) {
            if (err.response && err.response.status !== 404) {
                return res.status(500).json({ error: "Failed to read file" });
            }
        }

        messages.push({
            timestamp: new Date().toISOString(),
            response: response.data
        });

        const encodedContent = Buffer.from(JSON.stringify(messages, null, 2)).toString("base64");

        const data = {
            message: `Updated ${filePath} with HTTP response`,
            content: encodedContent,
            sha: sha || undefined
        };

        await axios.put(githubUrl, data, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });

        res.json({ success: true, message: "HTTP response stored in GitHub" });
    } catch (error) {
        res.status(500).json({ error: "HTTP request failed", details: error.response?.data || error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
