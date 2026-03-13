# Boosted HP Calculator

Estimate the horsepower gains from adding turbocharger boost to a naturally aspirated engine.

## Features

- Enter your current **Wheel HP (WHP)** or **Crank HP (BHP)** — the tool converts between the two automatically
- Select your **drivetrain layout** (RWD / FWD / AWD) for accurate drivetrain loss estimates
- Dial in your target **boost pressure** (1–60 PSI) via input or slider
- Choose a **turbo efficiency** preset (budget build → race-grade)
- Live **results panel** showing stock vs boosted WHP/BHP, HP gain, and % increase
- Animated **boost pressure gauge**
- Interactive **HP vs Boost curve chart** (powered by Chart.js)
- **Build risk indicator** — flags when supporting modifications are needed

## Formula

```
Pressure Ratio  = (14.7 + boost_psi) / 14.7
Boosted BHP     = Stock BHP × Pressure Ratio × Turbo Efficiency
Boosted WHP     = Boosted BHP × Drivetrain Ratio
```

Atmospheric pressure is taken as **14.7 PSI** (sea level).

## Usage

Open `index.html` in any modern browser — no build step or server required.
