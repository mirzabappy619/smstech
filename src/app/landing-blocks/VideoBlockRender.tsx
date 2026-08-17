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
			<section className="py-16 px-4 bg-red-50">
				<div className="max-w-4xl mx-auto text-center">
					<p className="text-red-600">Invalid YouTube URL</p>
				</div>
			</section>
		);
	}

	const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&controls=${showControls ? 1 : 0}`;

	return (
		<section className="py-16 px-4 bg-gray-50">
			<div className="max-w-4xl mx-auto">
				<h2 className="text-4xl font-bold text-center mb-4 text-gray-900">
					{title}
				</h2>
				{description && (
					<p className="text-xl text-center mb-8 text-gray-600">
						{description}
					</p>
				)}
				<div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-2xl">
					<iframe
						src={embedUrl}
						title={title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						className="absolute top-0 left-0 w-full h-full"
					/>
				</div>
			</div>
		</section>
	);
}
