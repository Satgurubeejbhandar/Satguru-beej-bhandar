import { YOUTUBE_VIDEOS, getYoutubeThumbnail, getYoutubeWatchUrl, SHOP } from "../data/content";
import { PageHero, Icon } from "../components/Shared";

export default function Youtube() {
  return (
    <div className="min-h-screen bg-cream">
      {/* सुंदर टॉप हेडर - जो नेविगेशन बार के नीचे से शुरू होगा */}
      <PageHero
        eyebrow="YouTube चैनल"
        title={<>कृषि सलाह व <span className="text-gold-400">वीडियो</span></>}
        sub="फसल बुवाई, रोग पहचान, सही दवाई की मात्रा और आधुनिक कृषि तकनीकों के वीडियो देखें।"
      />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-36 text-pine-950">
        {/* सब्सक्राइब बैनर */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-pine-950 border border-gold-400/20 p-5 rounded-2xl text-cream shadow-xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-gold-400">
              <Icon name="Youtube" className="text-red-500" size={26} /> सतगुरु बीज भंडार YouTube
            </h2>
            <p className="text-cream/70 text-sm mt-1">हमारे चैनल को सब्सक्राइब करें और हर नई वीडियो का अपडेट पाएं</p>
          </div>
          <a
            href={SHOP.youtube || "https://youtube.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition shrink-0 shadow-lg"
          >
            चैनल खोलें <Icon name="ExternalLink" size={16} />
          </a>
        </div>

        {/* वीडियो ग्रिड */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {YOUTUBE_VIDEOS.map((video) => (
            <a
              key={video.id}
              href={getYoutubeWatchUrl(video.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-pine-950 border border-gold-400/20 rounded-2xl overflow-hidden hover:border-red-500 transition duration-300 flex flex-col justify-between shadow-lg"
            >
              <div>
                {/* Thumbnail Container */}
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img
                    src={getYoutubeThumbnail(video.videoId)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {/* Play Button */}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                      <span className="text-white text-lg ml-0.5">▶</span>
                    </div>
                  </div>
                </div>

                {/* Text Area */}
                <div className="p-4">
                  <h3 className="font-bold text-base text-cream group-hover:text-gold-400 transition line-clamp-2">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-cream/70 text-xs mt-2 line-clamp-2 leading-relaxed">
                      {video.description}
                    </p>
                  )}
                </div>
              </div>

              {video.date && (
                <div className="p-4 pt-0 text-xs text-cream/50">
                  अपलोड: {video.date}
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}