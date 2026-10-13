import React, { useState, useEffect } from "react";

interface DailyForecast {
  date: string;
  weathercode: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  rainSum: number;
  windMax: number;
}

interface CurrentWeather {
  temp: number;
  weathercode: number;
  wind: number;
  humidity: number;
  rainProb: number;
  city: string;
}

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0:  { label: "साफ़ आकाश", icon: "☀️" },
  1:  { label: "अधिकतर साफ़", icon: "🌤️" },
  2:  { label: "आंशिक बादल", icon: "⛅" },
  3:  { label: "बादल छाए", icon: "☁️" },
  45: { label: "कोहरा", icon: "🌫️" },
  48: { label: "कोहरा", icon: "🌫️" },
  51: { label: "हल्की फुहार", icon: "🌦️" },
  53: { label: "फुहार", icon: "🌦️" },
  55: { label: "तेज़ फुहार", icon: "🌧️" },
  61: { label: "हल्की बारिश", icon: "🌧️" },
  63: { label: "बारिश", icon: "🌧️" },
  65: { label: "तेज़ बारिश", icon: "⛈️" },
  66: { label: "ठंडी बारिश", icon: "🌧️" },
  67: { label: "तेज़ ठंडी बारिश", icon: "🌧️" },
  71: { label: "हल्की बर्फबारी", icon: "🌨️" },
  73: { label: "बर्फबारी", icon: "🌨️" },
  75: { label: "तेज़ बर्फबारी", icon: "❄️" },
  77: { label: "बर्फ के दाने", icon: "🌨️" },
  80: { label: "हल्की बारिश", icon: "🌦️" },
  81: { label: "बारिश की बौछार", icon: "🌧️" },
  82: { label: "भारी बारिश", icon: "⛈️" },
  85: { label: "बर्फ की बौछार", icon: "🌨️" },
  86: { label: "तेज़ बर्फबारी", icon: "❄️" },
  95: { label: "आंधी-तूफ़ान", icon: "⛈️" },
  96: { label: "तूफ़ान और ओले", icon: "⛈️" },
  99: { label: "भयंकर तूफ़ान", icon: "⛈️" },
};

function getWeather(code: number) {
  return WEATHER_CODES[code] || { label: "मौसम", icon: "🌡️" };
}

function formatDay(dateStr: string, index: number) {
  if (index === 0) return "आज";
  if (index === 1) return "कल";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("hi-IN", { weekday: "short" });
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("hi-IN", { day: "numeric", month: "short" });
}

const WeatherWidget: React.FC = () => {
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [activeCity, setActiveCity] = useState("दिल्ली");

  const fetchByCoords = async (lat: number, lon: number, label: string) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
        `&timezone=Asia%2FKolkata&forecast_days=7`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("डेटा नहीं मिला");
      const data = await res.json();

      setCurrent({
        temp: Math.round(data.current.temperature_2m),
        weathercode: data.current.weather_code,
        wind: data.current.wind_speed_10m,
        humidity: data.current.relative_humidity_2m,
        rainProb:
          data.current.precipitation_probability ??
          data.daily.precipitation_probability_max[0] ??
          0,
        city: label,
      });

      const days: DailyForecast[] = data.daily.time.map(
        (date: string, i: number) => ({
          date,
          weathercode: data.daily.weather_code[i],
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
          rainProb: data.daily.precipitation_probability_max[i] ?? 0,
          rainSum: data.daily.precipitation_sum[i] ?? 0,
          windMax: data.daily.wind_speed_10m_max[i] ?? 0,
        })
      );
      setDaily(days);
      setActiveCity(label);
    } catch {
      setError("मौसम लोड नहीं हो पाया। कृपया पुनः प्रयास करें।");
    } finally {
      setLoading(false);
    }
  };

  // ===== अपडेटेड सर्च लॉजिक (UPDATED SEARCH LOGIC) =====
  const fetchByCity = async (cityName: string) => {
    if (!cityName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const cleanQuery = cityName.trim();

      // 1. पहले 10 सबसे सटीक परिणाम मँगवाएँ
      let geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          cleanQuery
        )}&count=10&countryCode=IN&language=hi`
      );
      let geoData = await geoRes.json();

      // अगर "sawar sardarshahar" लिखने पर सीधा परिणाम न मिले, तो आखिरी शब्द (उदा. Sardarshahar) से सर्च करें
      if (!geoData.results?.length && cleanQuery.includes(" ")) {
        const parts = cleanQuery.split(/\s+/);
        const mainCity = parts[parts.length - 1]; // "sardarshahar" उठाएगा
        geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            mainCity
          )}&count=10&countryCode=IN&language=hi`
        );
        geoData = await geoRes.json();
      }

      if (!geoData.results?.length) {
        setError(`"${cityName}" नहीं मिला। कृपया सही शहर / गाँव का नाम लिखें।`);
        setLoading(false);
        return;
      }

      const results = geoData.results;
      let selectedPlace = results[0];

      // मल्टी-वर्ड सर्च (जैसे तोलासर) के लिए बेहतर मैच खोजें
      const searchWords = cleanQuery.toLowerCase().split(/\s+/);
      if (searchWords.length > 1) {
        const matched = results.find((place: any) => {
          const fullName = `${place.name} ${place.admin3 || ''} ${place.admin2 || ''} ${place.admin1 || ''}`.toLowerCase();
          return searchWords.every((word) => fullName.includes(word));
        });
        if (matched) {
          selectedPlace = matched;
        }
      }

      // स्थान का स्पष्ट नाम बनाएँ: "Sardarshahar, Churu, Rajasthan"
      const placeDetails = [
        selectedPlace.name,
        selectedPlace.admin2, // जिला (जैसे: Churu)
        selectedPlace.admin1  // राज्य (जैसे: Rajasthan)
      ].filter(Boolean);

      const displayName = placeDetails.join(", ");

      await fetchByCoords(selectedPlace.latitude, selectedPlace.longitude, displayName);
    } catch {
      setError("शहर ढूँढने में समस्या आई।");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          fetchByCoords(pos.coords.latitude, pos.coords.longitude, "आपका क्षेत्र"),
        () => fetchByCity("Tolasar")
      );
    } else {
      fetchByCity("Tolasar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchByCity(cityInput);
  };

  const cw = current ? getWeather(current.weathercode) : null;
  const todayRain = current?.rainProb ?? 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-pine-200 bg-gradient-to-br from-pine-950 via-pine-900 to-[#1a3a2a] text-white shadow-xl">
      {/* ===== TOP BAR ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-wide flex items-center gap-2">
            🌦️ 7 दिनों का मौसम
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            किसानों के लिए वर्षा एवं तापमान की जानकारी
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="उदा. तोलासर..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            className="flex-1 sm:w-56 px-3 py-2 rounded-lg text-sm text-pine-900 bg-white border-0 outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-pine-950 font-bold text-sm transition"
          >
            खोजें
          </button>
        </form>
      </div>

      {loading && (
        <div className="py-16 text-center text-white/70">
          ⏳ मौसम लोड हो रहा है...
        </div>
      )}
      {error && !loading && (
        <div className="py-10 text-center text-red-300 px-4">{error}</div>
      )}

      {!loading && !error && current && cw && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <div className="md:col-span-1 flex flex-col items-center justify-center text-center p-4 rounded-xl bg-white/5 border border-white/10">
              {/* यहाँ अब पूरा पता जैसे Sardarshahar, Churu, Rajasthan दिखेगा */}
              <p className="text-sm font-semibold text-amber-300 mb-1">📍 {activeCity}</p>
              <div className="text-5xl mb-1">{cw.icon}</div>
              <div className="text-5xl sm:text-6xl font-bold leading-none">
                {current.temp}°
              </div>
              <p className="text-base mt-2 text-white/90">{cw.label}</p>
              <div className="flex gap-4 mt-3 text-xs text-white/60">
                <span>💧 नमी {current.humidity}%</span>
                <span>💨 {current.wind} किमी/घंटा</span>
              </div>
            </div>

            <div
              className={`md:col-span-2 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 p-6 rounded-xl border ${
                todayRain >= 60
                  ? "bg-blue-600/40 border-blue-400/50"
                  : todayRain >= 30
                  ? "bg-sky-700/30 border-sky-400/40"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="text-center">
                <p className="text-sm uppercase tracking-widest text-white/70 mb-1">
                  आज बारिश की संभावना
                </p>
                <div
                  className={`text-6xl sm:text-7xl font-black leading-none ${
                    todayRain >= 60
                      ? "text-sky-300"
                      : todayRain >= 30
                      ? "text-sky-200"
                      : "text-white"
                  }`}
                >
                  {todayRain}%
                </div>
                <p className="text-sm mt-2 text-white/80">
                  {todayRain >= 70
                    ? "⚠️ अधिक संभावना — खेत का कार्य योजना बनाएँ"
                    : todayRain >= 40
                    ? "बारिश संभव — सावधान रहें"
                    : "बारिश की कम संभावना"}
                </p>
              </div>

              {daily[0] && (
                <div className="flex flex-col gap-2 text-sm text-white/80 border-t sm:border-t-0 sm:border-l border-white/15 pt-4 sm:pt-0 sm:pl-8">
                  <div className="flex justify-between gap-6">
                    <span>आज अधिकतम / न्यूनतम</span>
                    <strong>
                      {daily[0].tempMax}° / {daily[0].tempMin}°
                    </strong>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>अनुमानित वर्षा</span>
                    <strong>{daily[0].rainSum.toFixed(1)} मिमी</strong>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>हवा (अधिकतम)</span>
                    <strong>{Math.round(daily[0].windMax)} किमी/घंटा</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 pb-5">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-3">
              अगले 7 दिन
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
              {daily.map((day, i) => {
                const w = getWeather(day.weathercode);
                const isToday = i === 0;
                const highRain = day.rainProb >= 50;
                return (
                  <div
                    key={day.date}
                    className={`rounded-xl p-3 text-center border transition ${
                      isToday
                        ? "bg-amber-500/20 border-amber-400/40"
                        : highRain
                        ? "bg-sky-600/20 border-sky-400/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <p className="text-xs font-semibold text-white/90">
                      {formatDay(day.date, i)}
                    </p>
                    <p className="text-[10px] text-white/45 mb-1">
                      {formatFullDate(day.date)}
                    </p>
                    <div className="text-2xl my-1">{w.icon}</div>
                    <p className="text-[11px] text-white/70 leading-tight mb-2 min-h-[2rem]">
                      {w.label}
                    </p>

                    <p className="text-sm font-bold">
                      {day.tempMax}°{" "}
                      <span className="text-white/40 font-normal">
                        / {day.tempMin}°
                      </span>
                    </p>

                    <div
                      className={`mt-2 rounded-lg py-1 px-1 text-xs font-bold ${
                        day.rainProb >= 60
                          ? "bg-blue-500 text-white"
                          : day.rainProb >= 30
                          ? "bg-sky-700/80 text-sky-100"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      🌧️ {day.rainProb}%
                    </div>
                    {day.rainSum > 0 && (
                      <p className="text-[10px] text-sky-200/80 mt-1">
                        {day.rainSum.toFixed(1)} मिमी
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WeatherWidget;