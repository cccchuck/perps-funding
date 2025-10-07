# API Reference

## Fetch Funding Rate Data

URL: "https://api.backpack.exchange/api/v1/markPrices"
Method: "GET"
Response Example:

```json
[
  {
    "fundingRate": "-0.000129991",
    "indexPrice": "2.94851186",
    "markPrice": "2.94368915",
    "nextFundingTimestamp": 1759831200000,
    "symbol": "0G_USDC_PERP"
  },
  {
    "fundingRate": "0.000060601",
    "indexPrice": "0.46877575",
    "markPrice": "0.46931632",
    "nextFundingTimestamp": 1759831200000,
    "symbol": "2Z_USDC_PERP"
  }
]
```
