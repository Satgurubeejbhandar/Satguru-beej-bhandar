import { FACEBOOK_POSTS, SHOP } from "../data/content";
import { PageHero, Icon } from "../components/Shared";

export default function Facebook() {
  return (
    <div className="min-h-screen bg-cream">
      {/* सुंदर टॉप हेडर */}
      <PageHero
        eyebrow="Facebook अपडेट्स"
        title={<>सोशल मीडिया <span className="text-gold-400">पेज</span></>}
        sub="फेसबुक पर हमारे साथ जुड़ें और दुकान के नए स्टॉक, रेट व खबरों की जानकारी पाएं।"
      />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-36 text-pine-950">
        {/* हेडर बैनर */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-pine-950 border border-gold-400/20 p-5 rounded-2xl text-cream shadow-xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-gold-400">
              <Icon name="Facebook" className="text-blue-500" size={26} /> सतगुरु बीज भंडार Facebook
            </h2>
            <p className="text-cream/70 text-sm mt-1">ताज़ा अपडेट्स और दुकान की जानकारियों के लिए फॉलो करें</p>
          </div>
          <a
            href={SHOP.facebook || "https://facebook.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition shrink-0 shadow-lg"
          >
            पेज फॉलो करें <Icon name="ExternalLink" size={16} />
          </a>
        </div>

        {/* पोस्ट्स लिस्ट */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FACEBOOK_POSTS.map((post) => (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-pine-950 border border-gold-400/20 p-6 rounded-2xl hover:border-blue-500 transition duration-300 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs mb-2">
                  <Icon name="Facebook" size={16} />
                  <span>Facebook Post</span>
                </div>
                <h3 className="font-bold text-lg text-cream group-hover:text-gold-400 transition">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="text-cream/70 text-sm mt-2 leading-relaxed">
                    {post.description}
                  </p>
                )}
              </div>
              <div className="mt-6 text-sm text-gold-400 font-medium group-hover:underline flex items-center gap-1">
                फेसबुक पर देखें ↗
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}