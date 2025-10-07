# Lighter API Reference

## Subscribe Funding Rate Data

WebSocket 链接：wss://mainnet.zklighter.elliot.ai/stream

建立连接后，会收到以下响应：

```json
{
  "session_id": "6b27e9ee-3ec0-4321-8832-993fde229187",
  "type": "connected"
}
```

然后发送该订阅消息：

```json
{
  "type": "subscribe",
  "channel": "market_stats/all"
}
```

首次订阅后，会全量推送所有的数据：

```json
{
  "type": "subscribed/market_stats",
  "channel": "market_stats:all",
  "market_stats": {
    "0": {
      "market_id": 0,
      "index_price": "4670.22",
      "mark_price": "4670.63",
      "open_interest": "186660482.292979",
      "open_interest_limit": "72057594037927936.000000",
      "funding_clamp_small": "0.0500",
      "funding_clamp_big": "4.0000",
      "last_trade_price": "4670.81",
      "current_funding_rate": "0.0012",
      "funding_rate": "0.0012",
      "funding_timestamp": 1759824000001,
      "daily_base_token_volume": 402872.5138,
      "daily_quote_token_volume": 1879075842.376637,
      "daily_price_low": 4558,
      "daily_price_high": 4741.38,
      "daily_price_change": 2.120792689726652
    },
    ...,
  }
}
```

在数据有更新时，会推送更新的数据：

```json
{
  "channel": "market_stats:all",
  "market_stats": {
    "0": {
      "market_id": 0,
      "index_price": "4670.22",
      "mark_price": "4670.63",
      "open_interest": "186660435.586679",
      "open_interest_limit": "72057594037927936.000000",
      "funding_clamp_small": "0.0500",
      "funding_clamp_big": "4.0000",
      "last_trade_price": "4670.81",
      "current_funding_rate": "0.0012",
      "funding_rate": "0.0012",
      "funding_timestamp": 1759824000001,
      "daily_base_token_volume": 402872.5138,
      "daily_quote_token_volume": 1879075842.376637,
      "daily_price_low": 4558,
      "daily_price_high": 4741.38,
      "daily_price_change": 2.120792689726652
    }
  },
  "type": "update/market_stats"
}
```

此外，服务端会定时向客户端发送：

```json
{
  "type": "ping"
}
```

客户端收到后应该回复：

```json
{
  "type": "pong"
}
```

其中 `market_id` 与 `symbol` 的映射可以缓存该接口的信息："https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails"，请求方法是 `GET`，以下是一个返回的示例：

```json
{
  "code": 200,
  "order_book_details": [
    {
      "symbol": "SYRUP",
      "market_id": 44,
      "status": "active",
      "taker_fee": "0.0000",
      "maker_fee": "0.0000",
      "liquidation_fee": "1.0000",
      "min_base_amount": "20.0",
      "min_quote_amount": "10.000000",
      "order_quote_limit": "",
      "supported_size_decimals": 1,
      "supported_price_decimals": 5,
      "supported_quote_decimals": 6,
      "size_decimals": 1,
      "price_decimals": 5,
      "quote_multiplier": 1,
      "default_initial_margin_fraction": 2000,
      "min_initial_margin_fraction": 2000,
      "maintenance_margin_fraction": 1200,
      "closeout_margin_fraction": 800,
      "last_trade_price": 0.40586,
      "daily_trades_count": 10998,
      "daily_base_token_volume": 23836504.4,
      "daily_quote_token_volume": 9891610.124046,
      "daily_price_low": 0.4055,
      "daily_price_high": 0.428,
      "daily_price_change": -0.6677592153217718,
      "open_interest": 1083789.1,
      "daily_chart": {},
      "market_config": {
        "market_margin_mode": 0,
        "insurance_fund_account_index": 281474976710655
      }
    }
  ]
}
```
