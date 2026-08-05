import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict
from loguru import logger
from sqlalchemy.orm import Session

from src.database.models import TrendAnalysis
from src.database.session import SessionLocal


class TrendlineAnalyzer:
    def __init__(self, length: int = 14, mult: float = 1.0, calc_method: str = "Atr"):
        self.length = length
        self.mult = mult
        self.calc_method = calc_method

    def calculate_slope(self, df: pd.DataFrame) -> pd.Series:
        close_col = "Close" if "Close" in df.columns else "close"
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"

        src = df[close_col]
        if self.calc_method == "Atr":
            tr = np.maximum(
                df[high_col] - df[low_col],
                np.maximum(
                    abs(df[high_col] - df[close_col].shift()),
                    abs(df[low_col] - df[close_col].shift()),
                ),
            )
            return tr.rolling(self.length).mean() / self.length * self.mult
        elif self.calc_method == "Stdev":
            return src.rolling(self.length).std() / self.length * self.mult
        else:
            x = np.arange(len(df))
            y = src
            slope = (
                self.length * (x * y).rolling(self.length).sum()
                - x.rolling(self.length).sum() * y.rolling(self.length).sum()
            ) / (
                self.length * (x ** 2).rolling(self.length).sum()
                - (x.rolling(self.length).sum()) ** 2
            )
            return np.abs(slope) * self.mult

    def detect_pivots(self, df: pd.DataFrame):
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"
        ph = df[high_col].rolling(self.length * 2 + 1, center=True).max() == df[high_col]
        pl = df[low_col].rolling(self.length * 2 + 1, center=True).min() == df[low_col]
        return ph.shift(-self.length), pl.shift(-self.length)

    def analyze(self, df: pd.DataFrame, ticker: str = "UNKNOWN") -> Dict:
        if len(df) < self.length * 3:
            return {"error": "Not enough data"}

        df = df.copy().reset_index(drop=True)

        close_col = "Close" if "Close" in df.columns else "close"
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"

        slope_series = self.calculate_slope(df)
        ph, pl = self.detect_pivots(df)

        upper = np.nan
        lower = np.nan
        slope_ph = slope_pl = 0.0
        results = []

        for i in range(len(df)):
            if ph.iloc[i]:
                slope_ph = slope_series.iloc[i]
                upper = df[high_col].iloc[i]
            elif not np.isnan(upper):
                upper -= slope_ph

            if pl.iloc[i]:
                slope_pl = slope_series.iloc[i]
                lower = df[low_col].iloc[i]
            elif not np.isnan(lower):
                lower += slope_pl

            current_upper = upper - slope_ph * self.length if not np.isnan(upper) else np.nan
            current_lower = lower + slope_pl * self.length if not np.isnan(lower) else np.nan

            bu = df[close_col].iloc[i] > current_upper if not np.isnan(current_upper) else False
            bd = df[close_col].iloc[i] < current_lower if not np.isnan(current_lower) else False

            results.append({
                "upper": upper, "lower": lower,
                "breakout_up": bu, "breakout_dn": bd,
                "slope_ph": slope_ph, "slope_pl": slope_pl,
            })

        df_results = pd.DataFrame(results)
        latest = df_results.iloc[-1]
        prev = df_results.iloc[-2] if len(df_results) > 1 else latest

        atr = self._calculate_atr(df)
        recent = df.tail(20)
        x = np.arange(len(recent))
        slope_lr, _ = np.polyfit(x, recent[close_col], 1)

        # NaN guard: trendlines may not have a pivot yet for freshly-listed
        # tickers. Only declare a breakout when both the trendline and the
        # breakout signal are valid finite numbers.
        cur_price = float(df[close_col].iloc[-1])
        upper = latest["upper"]
        lower = latest["lower"]
        bu_valid = bool(latest["breakout_up"]) and not np.isnan(upper) and upper > 0
        bd_valid = bool(latest["breakout_dn"]) and not np.isnan(lower) and lower > 0

        if bu_valid:
            breakout_dist = max(cur_price - upper, 0.0)
            raw = upper + breakout_dist * 1.5 + atr * 2
            # Cap projected move to ±20% of current price so a single volatile
            # bar can't produce a 10x target.
            target = min(raw, cur_price * 1.20)
            direction = "BULLISH"
            confidence = 0.72
        elif bd_valid:
            breakout_dist = max(lower - cur_price, 0.0)
            raw = lower - breakout_dist * 1.5 - atr * 2
            target = max(raw, cur_price * 0.80)
            direction = "BEARISH"
            confidence = 0.72
        else:
            slope_proj = cur_price + slope_lr * 10
            # Keep SIDEWAYS projection within ±10% of current price.
            target = max(min(slope_proj, cur_price * 1.10), cur_price * 0.90)
            direction = "SIDEWAYS"
            confidence = 0.45

        if np.isnan(target):
            target = cur_price

        analysis = {
            "ticker": ticker,
            "timestamp": datetime.now().isoformat(),
            "current_price": float(df[close_col].iloc[-1]),
            "upper_trend": float(latest["upper"]) if not np.isnan(latest["upper"]) else None,
            "lower_trend": float(latest["lower"]) if not np.isnan(latest["lower"]) else None,
            "slope_ph": float(latest["slope_ph"]),
            "slope_pl": float(latest["slope_pl"]),
            "breakout_up": bool(latest["breakout_up"] and not prev["breakout_up"]),
            "breakout_dn": bool(latest["breakout_dn"] and not prev["breakout_dn"]),
            "predicted_price": float(target),
            "confidence": confidence,
            "prediction_text": (
                f"{direction} breakout detected. LR slope: {slope_lr:.4f}. "
                f"Volatility-adjusted target: {target:.2f}"
            ),
            "trend_state": direction,
            "atr": float(atr),
        }

        self.save_to_db(analysis)
        logger.success(f"Trendline analysis for {ticker} → {direction}")
        return analysis

    def _calculate_atr(self, df: pd.DataFrame) -> float:
        """Average True Range over 14 bars. Returns 0.0 if the frame is too
        short for a full rolling window (otherwise the mean is NaN)."""
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"
        close_col = "Close" if "Close" in df.columns else "close"
        if len(df) < 14:
            return 0.0
        tr = np.maximum(
            df[high_col] - df[low_col],
            np.maximum(
                abs(df[high_col] - df[close_col].shift()),
                abs(df[low_col] - df[close_col].shift()),
            ),
        )
        val = tr.rolling(14).mean().iloc[-1]
        return float(val) if not np.isnan(val) else 0.0

    def save_to_db(self, analysis: Dict):
        db: Session = SessionLocal()
        try:
            record = TrendAnalysis(
                ticker=analysis["ticker"],
                current_price=analysis["current_price"],
                upper_trend=analysis.get("upper_trend"),
                lower_trend=analysis.get("lower_trend"),
                breakout_up=analysis["breakout_up"],
                breakout_dn=analysis["breakout_dn"],
                predicted_price=analysis["predicted_price"],
                confidence=analysis["confidence"],
                prediction_text=analysis["prediction_text"],
                trend_state=analysis["trend_state"],
                atr=analysis["atr"],
            )
            db.add(record)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to save trend analysis: {e}")
        finally:
            db.close()
