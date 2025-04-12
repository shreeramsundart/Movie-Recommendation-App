import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { genre, language, additionalDetails, userId, savePreferences } = await request.json();
    console.log('Received request:', { genre, language, additionalDetails, userId, savePreferences });

    if (!genre) {
      return NextResponse.json({ error: 'Genre is required' }, { status: 400 });
    }

    // Save user preferences if requested
    if (savePreferences && userId) {
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_id: userId,
              genre,
              language,
              additional_details: additionalDetails,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          );

        if (error) throw error;
      } catch (error) {
        console.error('Error saving preferences:', error);
        // Don't fail the whole request if preference saving fails
      }
    }

    // Gemini API call
    console.log('Calling Gemini API');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    try {
      const prompt = `Provide exactly 20 movie recommendations that strictly match these criteria:
      - Genre: ${genre}
      - Language: ${language}
      - Additional preferences: ${additionalDetails || 'none'}
      
      Return ONLY a JSON array of movie titles in this exact format:
      ["Movie Title 1", "Movie Title 2", ..., "Movie Title 20"]`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const textResponse = response.text().trim();
      
      // Parse the JSON response
      let movieTitles = [];
      try {
        // Clean the response if needed
        const cleanedResponse = textResponse.replace(/```json|```/g, '').trim();
        movieTitles = JSON.parse(cleanedResponse);
        if (!Array.isArray(movieTitles) || movieTitles.length === 0) {
          throw new Error('Invalid response format - expected array of movie titles');
        }
      } catch (e) {
        console.error('Failed to parse Gemini response:', textResponse);
        return NextResponse.json({ 
          error: 'Failed to parse movie recommendations',
          details: 'Gemini returned an invalid format',
          response: textResponse
        }, { status: 500 });
      }

      console.log('Gemini suggested movies:', movieTitles);

      // TMDB API calls
      const tmdbApiKey = process.env.TMDB_API_KEY;
      if (!tmdbApiKey) {
        return NextResponse.json({ error: 'TMDB API key is not configured' }, { status: 500 });
      }

      console.log('Calling TMDB API for movie details');
      const movieDetailsPromises = movieTitles.map(async (title) => {
        try {
          const response = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}&language=${language}&page=1&include_adult=false`
          );
          
          if (!response.data.results || response.data.results.length === 0) {
            console.warn(`No TMDB results for: ${title}`);
            return null;
          }
          
          // Find the best match
          const exactMatch = response.data.results.find(
            (movie) => movie.title && movie.title.toLowerCase() === title.toLowerCase()
          );
          
          const movieToUse = exactMatch || response.data.results[0];
          
          if (!movieToUse.title) {
            console.warn(`Invalid movie data for: ${title}`, movieToUse);
            return null;
          }
          
          return movieToUse;
        } catch (error) {
          console.error(`Error fetching TMDB data for ${title}:`, error);
          return null;
        }
      });

      const movieDetailsResults = await Promise.all(movieDetailsPromises);
      const validMovies = movieDetailsResults.filter(movie => movie !== null);

      if (validMovies.length === 0) {
        return NextResponse.json({ 
          error: 'No movies found matching your criteria',
          details: 'TMDB returned no valid results for the suggested movies'
        }, { status: 404 });
      }

      // Fetch additional details for each valid movie
      const enrichedMovies = await Promise.all(
        validMovies.map(async (movie) => {
          try {
            const detailsResponse = await axios.get(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}&append_to_response=credits,videos,similar`
            );
            
            let providers = null;
            try {
              const providersResponse = await axios.get(
                `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${tmdbApiKey}`
              );
              providers = providersResponse.data.results?.US || null;
            } catch (e) {
              console.error('Error fetching providers:', e);
            }

            const movieData = {
              id: movie.id,
              title: movie.title,
              overview: movie.overview || 'No overview available',
              poster_path: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
              backdrop_path: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
              release_date: movie.release_date || 'Unknown',
              vote_average: movie.vote_average || 0,
              vote_count: movie.vote_count || 0,
              runtime: detailsResponse.data.runtime || 0,
              genres: detailsResponse.data.genres || [],
              credits: detailsResponse.data.credits || { cast: [], crew: [] },
              videos: detailsResponse.data.videos?.results || [],
              similar: detailsResponse.data.similar?.results || [],
              providers,
              original_language: movie.original_language || 'en',
              status: detailsResponse.data.status || 'Unknown',
              tagline: detailsResponse.data.tagline || '',
            };

            // Optionally save individual movies to user preferences
            if (userId) {
              try {
                await supabase
                  .from('user_movies')
                  .upsert(
                    {
                      user_id: userId,
                      movie_id: movie.id,
                      movie_data: movieData,
                      genre: movieData.genres.map(g => g.name).join(', '),
                      language: movieData.original_language,
                      updated_at: new Date().toISOString()
                    },
                    { onConflict: 'user_id,movie_id' }
                  );
              } catch (error) {
                console.error('Error saving movie to user preferences:', error);
              }
            }

            return movieData;
          } catch (error) {
            console.error(`Error enriching details for ${movie.title}:`, error);
            // Return basic movie info if enrichment fails
            return {
              id: movie.id,
              title: movie.title,
              overview: movie.overview || 'No overview available',
              poster_path: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
              backdrop_path: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
              release_date: movie.release_date || 'Unknown',
              vote_average: movie.vote_average || 0,
              vote_count: movie.vote_count || 0,
              runtime: 0,
              genres: [],
              credits: { cast: [], crew: [] },
              videos: [],
              similar: [],
              providers: null,
              original_language: movie.original_language || 'en',
              status: 'Unknown',
              tagline: '',
            };
          }
        })
      );

      return NextResponse.json(enrichedMovies);
    } catch (genAIError) {
      console.error('Gemini API error:', genAIError);
      return NextResponse.json({ 
        error: `Gemini API error: ${genAIError.message}`,
        details: 'Failed to generate movie recommendations'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ 
      error: `API route error: ${error.message}`,
      details: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to save a movie list to Supabase
async function saveMovieList(userId, listName, movies, searchCriteria) {
  try {
    const { data, error } = await supabase
      .from('movie_lists')
      .insert([
        {
          user_id: userId,
          name: listName,
          genre: searchCriteria.genre,
          language: searchCriteria.language,
          additional_details: searchCriteria.additionalDetails,
          movies: movies,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error saving movie list:', error);
    throw error;
  }
}