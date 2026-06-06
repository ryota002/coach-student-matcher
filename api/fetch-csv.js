module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "GETのみ対応しています。" });
    return;
  }

  const target = req.query.url;
  if (!target || !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(target)) {
    res.status(400).json({ error: "Google SheetsのCSVエクスポートURLを指定してください。" });
    return;
  }

  try {
    const response = await fetch(target);
    const text = await response.text();

    if (!response.ok) {
      res.status(response.status).json({
        error: `${response.status} ${response.statusText}`,
        body: text.slice(0, 300),
      });
      return;
    }

    if (/<!doctype html|<html/i.test(text)) {
      res.status(403).json({
        error: "CSVではなくHTMLが返りました。スプレッドシートの共有設定を確認してください。",
      });
      return;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.status(200).send(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
