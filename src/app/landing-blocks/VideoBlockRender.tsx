"use client";

import { VideoBlockData } from "../landing-page-types";

interface VideoBlockRenderProps {
	data: VideoBlockData;
}

function extractYouTubeId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
		/^([a-zA-Z0-9_-]{11})$/,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) return match[1];
	}

	return null;
}

export default function VideoBlockRender({ data }: VideoBlockRenderProps) {
	const {
		youtubeUrl,
		title,
		description,
		autoplay = false,
		showControls = true,
	} = data;

	const videoId = extractYouTubeId(youtubeUrl);

	if (!videoId) {
		return (
			<section className="bg-bg px-6 py-16">
				<div className="mx-auto max-w-3xl rounded-xl border border-danger-line bg-danger-soft px-6 py-8 text-center">
					<p className="text-[13.5px] text-danger">
						This video block has an invalid YouTube URL.
					</p>
				</div>
			</section>
		);
	}

	const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&controls=${showControls ? 1 : 0}`;

	return (
		<section className="bg-bg px-6 py-20">
			<div className="mx-auto max-w-4xl">
				<div className="mx-auto mb-8 max-w-2xl text-center">
					<h2 className="font-display text-[28px] font-semibold tracking-tight text-ink md:text-[36px]">
						{title}
					</h2>
					{description && (
						<p className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</p>
					)}
				</div>
				<div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface-2">
					<iframe
						src={embedUrl}
						title={title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						className="absolute left-0 top-0 h-full w-full"
					/>
				</div>
			</div>
		</section>
	);
}
