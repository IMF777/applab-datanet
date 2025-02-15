const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "IMF777";
const REPO = "DATANET";
let lastRequestTime = 0;

app.get("/message/write", async (req, res) => {
    const { id, message } = req.query;
    if (!id || !message) {
        return res.status(400).send("Missing parameters");
    }

    const now = Date.now();
    if (now - lastRequestTime < 2000) {
        return res.status(429).send("Duplicate request detected, ignoring.");
    }
    lastRequestTime = now;

    try {
        await writeMessageToGitHub(id, message);
        res.send("Message written successfully.");
    } catch (error) {
        res.status(500).send("Error writing message.");
    }
});

async function writeMessageToGitHub(id, message) {
    const FILE_PATH = `datasets/inbox/${id}.json`;
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

    try {
        const response = await axios.get(url, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });
        const sha = response.data.sha;
        const existingContent = Buffer.from(response.data.content, "base64").toString("utf8");
        const messages = JSON.parse(existingContent);

        messages.push({ timestamp: new Date().toISOString(), message });
        const updatedContent = Buffer.from(JSON.stringify(messages, null, 2)).toString("base64");

        await axios.put(url, {
            message: "Updated message inbox",
            content: updatedContent,
            sha,
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` },
        });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            const newContent = Buffer.from(JSON.stringify([{ timestamp: new Date().toISOString(), message }], null, 2)).toString("base64");
            await axios.put(url, {
                message: "Created new inbox file",
                content: newContent,
            }, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            });
        } else {
            throw error;
        }
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

