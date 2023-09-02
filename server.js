const express = require("express");
const path = require("path");

const app = express();


app.get("/*", (req, res) => {
    // res.sendFile(path.resolve("customer", "index.html"));
    res.sendFile(path.resolve("", "index.html"));
    // res.sendFile("index.html");
});

let port = process.env.PORT || 3000
app.listen(port, () => console.log(`Server running at ${port}`));
