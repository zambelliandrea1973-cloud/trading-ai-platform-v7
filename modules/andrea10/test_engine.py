import unittest
from engine import Bar, evaluate

class Andrea10Tests(unittest.TestCase):
    def setUp(self):
        self.bars = [Bar(i, 100, 101, 99, 100) for i in range(21)]
    def test_closed(self):
        self.assertEqual(evaluate(self.bars, market_open=False, bridge_healthy=True).reason, "MARKET_CLOSED")
    def test_bridge(self):
        self.assertEqual(evaluate(self.bars, market_open=True, bridge_healthy=False).state, "BLOCK")
    def test_no_signal(self):
        self.assertEqual(evaluate(self.bars, market_open=True, bridge_healthy=True).reason, "NO_BREAKOUT")
    def test_risk_gate(self):
        bars = self.bars[:-1] + [Bar(20, 100, 103, 99, 102)]
        self.assertEqual(evaluate(bars, market_open=True, bridge_healthy=True).reason, "RISK_BRAIN_APPROVAL_REQUIRED")
    def test_stale(self):
        self.assertEqual(evaluate(self.bars, market_open=True, bridge_healthy=True, now_timestamp=200).reason, "STALE_OR_FUTURE_DATA")

if __name__ == "__main__":
    unittest.main()
