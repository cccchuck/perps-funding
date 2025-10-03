# DEX 资费套利面板

背景：随着 HyperLiquid 的爆火，越来越多的去中心化永续合约平台如雨后春笋般涌现。因此，交易所与交易所之间自然而然会有资金费的价差，所以该面板负责提供一个比较清晰的资金费价差聚合面板。

## 支持的 DEX

- [x] edgeX
- [x] Lighter

### edgeX

edgeX 获取资费的方式是通过 WebSocket 进行订阅，链接为：wss://quote.edgex.exchange/api/v1/public/ws?timestamp=1759476750010。

连接后，需发送 `{"type":"subscribe","channel":"ticker.all.1s"}` 订阅，订阅成功后会返回 `{"type":"subscribed","channel":"ticker.all.1s","request":"{\"type\":\"subscribe\",\"channel\":\"ticker.all.1s\"}"}`，紧接着便开始推送数据，以下是一个示例数据（Snapshot）：
`{"type":"quote-event","channel":"ticker.all.1s","content":{"channel":"ticker.all.1s","dataType":"Snapshot","data":[{
    "contractId": "10000001",
    "contractName": "BTCUSD",
    "priceChange": "1320.0",
    "priceChangePercent": "0.011141",
    "trades": "197464",
    "size": "15234.995",
    "value": "1823575062.6974",
    "high": "120997.1",
    "low": "118308.1",
    "open": "118473.0",
    "close": "119793.0",
    "highTime": "1759432484921",
    "lowTime": "1759392904256",
    "startTime": "1759390200000",
    "endTime": "1759476600000",
    "lastPrice": "119793.0",
    "indexPrice": "119836.734979504",
    "oraclePrice": "119850.178086198866367340087890625",
    "openInterest": "6792.701",
    "fundingRate": "0.00002547",
    "fundingTime": "1759464000000",
    "nextFundingTime": "1759478400000",
    "bestAskPrice": "119794.1",
    "bestBidPrice": "119791.7"
}]}}`

当有数据发生变化时只会更新变化的部分，如：`{"type":"quote-event","channel":"ticker.all.1s","content":{"channel":"ticker.all.1s","dataType":"changed","data":[{
    "contractId": "10000024",
    "contractName": "UNI2USD",
    "priceChange": "0.113",
    "priceChangePercent": "0.011388",
    "trades": "0",
    "size": "0",
    "value": "0",
    "high": "10.128",
    "low": "9.773",
    "open": "10.035",
    "close": "10.035",
    "highTime": "1756318424986",
    "lowTime": "1756341303982",
    "startTime": "1759390200000",
    "endTime": "1759476600000",
    "lastPrice": "10.035",
    "indexPrice": "8.205045041",
    "oraclePrice": "8.2091805641539394855499267578125",
    "openInterest": "0",
    "fundingRate": "0.00005000",
    "fundingTime": "1759464000000",
    "nextFundingTime": "1759478400000",
    "bestAskPrice": "0",
    "bestBidPrice": "0"
}]}}`

在连接打开阶段，服务器会定时向客户端发送 Ping，如：`{"type":"ping","time":"1759476760000"}`，客户端收到消息后，需及时发送：Pong，如：`{"type":"pong","time":"1759476761000"}`

### Lighter

Lighter 获取资金费率的方式简单，直接就是：“curl --request GET \
 --url https://mainnet.zklighter.elliot.ai/api/v1/funding-rates \
 --header 'accept: application/json'”，返回的内容为：```
{"code":200,"funding_rates":[{{
"market_id": 20,
"exchange": "binance",
"symbol": "BERA",
"rate": 0.0001
}}]}

## 任务

现在你的任务就是，定时获取两个交易所的资金费率，然后比较资金费差，如 BTC 在 Lighter 做多，EdgeX 做空的资金费差和在 Lighter 做空，EdgeX 做多的资金费差。之后按照资金费差的大小进行一个从大到小的排名，对于某一个币种如 X 只有在 Lighter 上线，没有在 EdgeX 上线，那就暂时不要考虑它。
