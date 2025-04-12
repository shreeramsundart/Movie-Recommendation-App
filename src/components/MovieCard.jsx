import React from 'react';
import Image from 'next/image';

const MovieCard = ({ movie, onSaveToList, userLists, onAddToExistingList, user }) => {
  const director = movie.credits?.crew.find(person => person.job === 'Director');
  const trailer = movie.videos?.find(video => video.site === 'YouTube' && video.type === 'Trailer');

  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : '/images/no-poster.png';

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105 hover:shadow-xl h-full flex flex-col">
      {/* Poster Image */}
      <div className="relative h-96 flex-shrink-0">
        {movie.poster_path ? (
          <Image
            src={posterUrl}
            alt={movie.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full bg-gray-700 flex items-center justify-center">
            <span className="text-gray-400">No poster available</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-bold text-white">{movie.title}</h2>
          <div className="flex items-center bg-yellow-500 text-gray-900 px-2 py-1 rounded">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{movie.vote_average?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>
        
        {movie.tagline && <p className="text-gray-400 italic mb-2">"{movie.tagline}"</p>}
        
        <div className="flex flex-wrap gap-2 mb-4">
          {movie.genres?.map(genre => (
            <span key={genre.id} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm">
              {genre.name}
            </span>
          ))}
        </div>
        
        <p className="text-gray-300 mb-4 line-clamp-3">{movie.overview}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-gray-400 text-sm">Release Date</h3>
            <p className="text-white">{movie.release_date || 'Unknown'}</p>
          </div>
          <div>
            <h3 className="text-gray-400 text-sm">Runtime</h3>
            <p className="text-white">{movie.runtime ? `${movie.runtime} mins` : 'Unknown'}</p>
          </div>
          <div>
            <h3 className="text-gray-400 text-sm">Language</h3>
            <p className="text-white">{movie.original_language?.toUpperCase() || 'Unknown'}</p>
          </div>
          <div>
            <h3 className="text-gray-400 text-sm">Status</h3>
            <p className="text-white">{movie.status || 'Unknown'}</p>
          </div>
        </div>
        
        {director && (
          <div className="mb-4">
            <h3 className="text-gray-400 text-sm">Director</h3>
            <p className="text-white">{director.name}</p>
          </div>
        )}
        
        {trailer && (
          <div className="mb-4">
            <a 
              href={`https://www.youtube.com/watch?v=${trailer.key}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-400 hover:text-blue-300"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Watch Trailer
            </a>
          </div>
        )}
        
        {/* Save Button Section - Now fixed at the bottom */}
        <div className="mt-auto pt-4">
          {user && (
            <>
              <button
                onClick={() => onSaveToList(movie)}
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-white transition-colors"
              >
                Save to List
              </button>
              

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;