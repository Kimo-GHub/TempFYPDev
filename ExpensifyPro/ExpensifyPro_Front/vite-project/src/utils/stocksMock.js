export const mockStocks = [
  { symbol: "AAPL", name: "Apple Inc.", price: 178.45, change: 1.24, changePct: 0.7, volume: "54.2M" },
  { symbol: "MSFT", name: "Microsoft", price: 326.1, change: -2.31, changePct: -0.7, volume: "32.8M" },
  { symbol: "NVDA", name: "NVIDIA", price: 468.9, change: 5.12, changePct: 1.1, volume: "21.5M" },
  { symbol: "AMZN", name: "Amazon", price: 133.4, change: 0.92, changePct: 0.7, volume: "28.7M" },
  { symbol: "GOOGL", name: "Alphabet", price: 138.75, change: -1.1, changePct: -0.8, volume: "19.4M" },
];

export function fetchMockStocks() {
  // mimic async call
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockStocks), 150);
  });
}
