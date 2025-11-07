# 🧩 Kafka Bulk Producer for Kafka UI

A simple **in-browser tool** that adds a powerful **bulk message producer UI** directly into your [Kafka UI](https://github.com/provectus/kafka-ui) dashboard — no external client or CLI required.

This script lets you:
- 🧠 **Detect clusters and topics** automatically from your Kafka UI instance  
- 🔍 **Search and filter** topics or clusters easily  
- 💬 **Paste multiple JSON messages** (NDJSON format)  
- 🚀 **Send them all at once** to any topic and partition  

---

## 🚀 How to Use

### 1️⃣ Open Kafka UI

Go to your [Kafka UI dashboard](https://kafka-ui.kafi.vn/) - [https://kafka-ui-kafi.vn/](https://kafka-ui.kafi.vn/), e.g.  

Press **F12** or **Ctrl + Shift + I** → open the **Console** tab.

---

### 2️⃣ Allow pasting (Chrome security)

Type this first:

```text
allow pasting
```

and press Enter.

---

### 3️⃣ Run the loader command

Paste this single line and press Enter:

```js
fetch("https://raw.githubusercontent.com/kafihoangvu/kafka-bulk-producer/main/main.js")
  .then(r => r.text())
  .then(eval)
  .catch(console.error);
```

💡 This fetches and runs the latest version of the Kafka Bulk Producer UI directly from GitHub.

---

### 4️⃣ Use the UI

A small window titled “Kafka UI – Bulk Producer” will appear.

Step 1 – Pick a cluster

All available clusters will load automatically.
You can search by name using the search box.

Step 2 – Pick a topic

After selecting a cluster, all topics (with pagination up to 1000) will be listed.
You can search topics client-side in the dropdown.

Step 3 – Paste messages

Paste one JSON object per line (NDJSON format), for example:

```json
{"messageType":"REQUEST","messageId":"mid","uri":"update","data":{"s":"CACB2516","is":"KAFI"}}
{"messageType":"REQUEST","messageId":"mid","uri":"update","data":{"s":"CVPB2532","is":"KAFI"}}
```
Each line represents a separate message.

Step 4 – Send 🚀

Choose a partition (or enable auto/null) and click Send.
Messages will be sent sequentially with a small throttle delay to avoid overload.

---

### ⚙️ Notes

Works only inside your Kafka UI web interface

Requires your Kafka UI to allow message producing (POST /messages)

Uses your current Kafka UI authentication cookies (same-origin fetch)

NDJSON = “newline-delimited JSON” → one JSON object per line

Fetches topics from /all-topics?perPage=1000 to ensure full coverage

---

### 🌟 Example Screenshot

<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/e96ac470-4d0c-42de-9b6e-5f88edac51db" />

---

### 🧑‍💻 Author

Hoang Vu
GitHub: @kafihoangvu


