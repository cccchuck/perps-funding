# ParaDex API Reference

## Subscribe Funding Rate Data

WebSocket 链接：wss://ws.api.prod.paradex.trade/v1?/

建立连接后，发送以下订阅：

```json
{
  "jsonrpc": "2.0",
  "method": "subscribe",
  "params": {
    "channel": "funding_data.ALL"
  },
  "id": 1
}
```

订阅成功后的响应：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "channel": "funding_data.ALL"
  },
  "usIn": 1759822712054358,
  "usDiff": 111,
  "usOut": 1759822712054469
}
```

之后所有的资金费用会通过以下的示例推送：

```json
{
  "jsonrpc": "2.0",
  "method": "subscription",
  "params": {
    "channel": "funding_data.ALL",
    "data": {
      "market": "HYPER-USD-PERP",
      "funding_index": "-0.1013629022003508722",
      "funding_premium": "0.000003498531863578174094",
      "funding_rate": "0.00001250176896",
      "funding_rate_8h": "0.00010001",
      "funding_period_hours": 1,
      "created_at": 1759822714408
    }
  }
}
```
