'use client'

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MovieCard from '@/components/MovieCard';
import { MagnifyingGlass } from 'react-loader-spinner';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilm, FiStar, FiList, FiUser, FiLogIn, FiLogOut, FiPlus, FiX, FiCheck, FiTrash2, FiEdit,  FiPhone, FiMail} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLists, setUserLists] = useState([]);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [currentMovie, setCurrentMovie] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState('recommendations');
  const [selectedListId, setSelectedListId] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [editedListName, setEditedListName] = useState('');
  
  // Auth states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Show toast notifications
  const showToast = (message, type = 'success') => {
    toast[type](message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  // Ensure a user profile exists
  const ensureProfileExists = async (userId) => {
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking profile:', fetchError);
        showToast('Error checking user profile', 'error');
      }
      
      if (!existingProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        const userMetadata = user?.user_metadata || {};
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            name: userMetadata.name || name || "Movie Fan",
            email: user.email,
            created_at: new Date().toISOString()
          }]);
          
        if (insertError) {
          console.error('Error creating profile:', insertError);
          showToast('Error creating user profile', 'error');
        }
      }
    } catch (error) {
      console.error('Error in ensureProfileExists:', error);
      showToast('Error setting up user profile', 'error');
    }
  };

  // Check for user session on component mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
          
          let displayName = data.user?.user_metadata?.name;
          
          if (!displayName) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', data.user.id)
              .single();
            
            displayName = profileData?.name || "Movie Fan";
          }
          
          setUserName(displayName);
          await ensureProfileExists(data.user.id);
          fetchUserLists(data.user.id);
        }
      } catch (error) {
        console.error('Error checking user:', error);
        showToast('Error checking user session', 'error');
      }
    };

    checkUser();

    // Set up auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          let displayName = session.user?.user_metadata?.name;
          
          if (!displayName) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', session.user.id)
              .single();
            
            displayName = profileData?.name || "Movie Fan";
          }
          
          setUserName(displayName);
          await ensureProfileExists(session.user.id);
          fetchUserLists(session.user.id);
          showToast('Successfully signed in!', 'success');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserName('');
          setUserLists([]);
          showToast('Successfully signed out', 'info');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserLists = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_movie_lists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserLists(data || []);
    } catch (error) {
      console.error('Error fetching user lists:', error);
      setError('Failed to load your movie lists');
      showToast('Failed to load your movie lists', 'error');
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      setAuthError('Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            name,
            email,
            created_at: new Date().toISOString()
          }]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          showToast('Error creating profile', 'error');
        }
      }

      setUserName(name);
      setShowAuthModal(false);
      showToast('Account created! Please check your email to verify your account.', 'success');
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError(error.message || 'Failed to create account');
      showToast(error.message || 'Failed to create account', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setAuthError('Please enter your email and password');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setShowAuthModal(false);
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error.message || 'Failed to sign in');
      showToast(error.message || 'Failed to sign in', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setShowMobileMenu(false);
    } catch (error) {
      console.error('Sign out error:', error);
      showToast('Error signing out', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMovies([]);
  
    try {
      const response = await axios.post('/api/recommendations', {
        genre,
        language,
        additionalDetails
      });
      
      if (response.data.error) {
        setError(response.data.error + (response.data.details ? ` (${response.data.details})` : ''));
        showToast(response.data.error, 'error');
      } else {
        setMovies(response.data);
        setActiveTab('recommendations');
        showToast(`Found ${response.data.length} movie recommendations!`, 'success');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.response?.data?.message || 'API request error'
        : 'An unexpected error occurred';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToNewList = (movie) => {
    if (!user) {
      setAuthMode('signin');
      setShowAuthModal(true);
      showToast('Please sign in to save movies', 'info');
      return;
    }
    setCurrentMovie(movie);
    setShowListModal(true);
  };

  const handleSaveToExistingList = async (movie, listId) => {
    try {
      const { data: listData, error: listError } = await supabase
        .from('user_movie_lists')
        .select('movies')
        .eq('id', listId)
        .single();

      if (listError) throw listError;

      const movieExists = listData.movies.some(m => m.id === movie.id);
      if (movieExists) {
        showToast('This movie is already in the list!', 'info');
        return;
      }

      const { error } = await supabase
        .from('user_movie_lists')
        .update({
          movies: [...listData.movies, movie],
          updated_at: new Date().toISOString()
        })
        .eq('id', listId);

      if (error) throw error;

      fetchUserLists(user.id);
      showToast('Movie added to list successfully!', 'success');
      setShowListModal(false);
    } catch (error) {
      console.error('Error saving to list:', error);
      setError('Failed to add movie to list');
      showToast('Failed to add movie to list', 'error');
    }
  };

  const createNewList = async () => {
    if (!newListName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('user_movie_lists')
        .insert([{
          user_id: user.id,
          name: newListName,
          movies: currentMovie ? [currentMovie] : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      
      setUserLists([data[0], ...userLists]);
      setNewListName('');
      setShowListModal(false);
      showToast(currentMovie 
        ? 'New list created and movie added successfully!' 
        : 'New list created successfully!', 'success');
    } catch (error) {
      console.error('Error creating new list:', error);
      setError('Failed to create new list');
      showToast('Failed to create new list', 'error');
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this list?')) return;
    
    try {
      const { error } = await supabase
        .from('user_movie_lists')
        .delete()
        .eq('id', listId);
      
      if (error) throw error;
      
      setUserLists(userLists.filter(list => list.id !== listId));
      showToast('List deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
      showToast('Failed to delete list', 'error');
    }
  };

  const handleRemoveMovieFromList = async (listId, movieId) => {
    try {
      const { data: listData, error: listError } = await supabase
        .from('user_movie_lists')
        .select('movies')
        .eq('id', listId)
        .single();

      if (listError) throw listError;

      const updatedMovies = listData.movies.filter(movie => movie.id !== movieId);

      const { error } = await supabase
        .from('user_movie_lists')
        .update({
          movies: updatedMovies,
          updated_at: new Date().toISOString()
        })
        .eq('id', listId);

      if (error) throw error;

      fetchUserLists(user.id);
      showToast('Movie removed from list successfully!', 'success');
    } catch (error) {
      console.error('Error removing movie from list:', error);
      setError('Failed to remove movie from list');
      showToast('Failed to remove movie from list', 'error');
    }
  };

  const startEditingList = (list) => {
    setEditingListId(list.id);
    setEditedListName(list.name);
  };

  const saveEditedList = async () => {
    if (!editedListName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('user_movie_lists')
        .update({
          name: editedListName,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingListId);

      if (error) throw error;

      fetchUserLists(user.id);
      setEditingListId(null);
      setEditedListName('');
      showToast('List name updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating list name:', error);
      setError('Failed to update list name');
      showToast('Failed to update list name', 'error');
    }
  };

  const renderMovieList = (list) => {
    return (
      <div className="space-y-4">
        {list.movies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.movies.map((movie) => (
              <div key={`${list.id}-${movie.id}`} className="relative">
                <MovieCard 
                  movie={movie} 
                  onSaveToList={() => handleSaveToNewList(movie)}
                  userLists={userLists}
                  onAddToExistingList={(listId) => handleSaveToExistingList(movie, listId)}
                  user={user}
                />
                <button
                  onClick={() => handleRemoveMovieFromList(list.id, movie.id)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full"
                  aria-label="Remove movie from list"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            This list is currently empty.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 text-white relative overflow-hidden">
      <ToastContainer />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-blue-500 opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-purple-500 opacity-10 blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-pink-500 opacity-10 blur-3xl animate-pulse delay-2000"></div>
      </div>
      
      <header className="bg-gray-800/80 backdrop-blur-sm py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="flex items-center"
            >
              <FiFilm className="text-3xl text-blue-400 " />
              <span className="ml-2 text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                CineMatcher.ai
              </span>
            </motion.div>
            
            {user && (
              <nav className="hidden md:flex items-center space-x-6 ml-8">
                <button 
                  onClick={() => {
                    setActiveTab('recommendations');
                    setShowMobileMenu(false);
                  }}
                  className={`flex items-center space-x-1 transition-colors ${activeTab === 'recommendations' ? 'text-blue-400' : 'text-blue-300 hover:text-blue-100'}`}
                >
                  <FiStar className="text-lg" />
                  <span>Recommendations</span>
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('lists');
                    setShowMobileMenu(false);
                  }}
                  className={`flex items-center space-x-1 transition-colors ${activeTab === 'lists' ? 'text-blue-400' : 'text-blue-300 hover:text-blue-100'}`}
                >
                  <FiList className="text-lg" />
                  <span>My Lists</span>
                </button>
              </nav>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center space-x-4"
              >
                <div className="hidden md:flex items-center space-x-2 bg-gray-700/50 px-3 py-1 rounded-full">
                  <FiUser className="text-blue-400" />
                  <span className="text-blue-400 font-medium">
                    {userName}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-white transition-colors"
                >
                  <FiLogOut className="text-lg" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                onClick={() => {
                  setAuthMode('signup');
                  setShowAuthModal(true);
                }}
                className="flex items-center space-x-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-medium text-white transition-colors"
              >
                <FiLogIn className="text-lg" />
                <span>Get Started</span>
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-gray-800/90 backdrop-blur-sm overflow-hidden"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {user ? (
                <>
                  <div className="flex items-center space-x-2 bg-gray-700/50 px-3 py-2 rounded-lg">
                    <FiUser className="text-blue-400" />
                    <span className="text-blue-400 font-medium">
                      {userName}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setActiveTab('recommendations');
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-2 rounded-lg ${activeTab === 'recommendations' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-300 hover:bg-gray-700/50'}`}
                  >
                    <FiStar />
                    <span>Recommendations</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveTab('lists');
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-2 rounded-lg ${activeTab === 'lists' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-300 hover:bg-gray-700/50'}`}
                  >
                    <FiList />
                    <span>My Lists</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
                  >
                    <FiLogOut />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setShowAuthModal(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg text-white"
                >
                  <FiLogIn />
                  <span>Get Started</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {activeTab === 'recommendations' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="max-w-3xl mx-auto bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-lg p-6 sm:p-8 mb-8 border border-gray-700"
          >
            <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Find Your Perfect Movie
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="genre" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                  <FiFilm className="mr-2" /> Movie Genre
                </label>
                <input
                  type="text"
                  id="genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g., Sci-Fi, Romance, Action"
                  className="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                  <FiStar className="mr-2" /> Preferred Language
                </label>
                <input
                  type="text"
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g., Tamil, Hindi, English"
                  className="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="details" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                  <FiList className="mr-2" /> Additional Preferences
                </label>
                <textarea
                  id="details"
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="e.g., from the 90s, with strong female lead, mind-bending plot"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !genre || !language}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-medium text-white transition-colors disabled:from-blue-800 disabled:to-indigo-800 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <MagnifyingGlass
                      visible={true}
                      height="20"
                      width="20"
                      ariaLabel="magnifying-glass-loading"
                      wrapperStyle={{}}
                      wrapperClass="magnifying-glass-wrapper"
                      glassColor="#c0efff"
                      color="#e15b64"
                    />
                    <span className="ml-2">Finding Your Movies...</span>
                  </>
                ) : (
                  'Find My Movies'
                )}
              </button>
            </form>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl mx-auto bg-red-900/50 border border-red-700 rounded-xl p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-red-200">{error}</p>
          </motion.div>
        )}

        {activeTab === 'recommendations' && movies.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                Your Movie Recommendations
              </h2>
              <span className="text-sm text-gray-400">
                {movies.length} results found
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {movies.map((movie, index) => (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <MovieCard 
                    movie={movie} 
                    onSaveToList={() => handleSaveToNewList(movie)}
                    userLists={userLists}
                    onAddToExistingList={(listId) => handleSaveToExistingList(movie, listId)}
                    user={user}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'lists' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                Your Movie Lists
              </h2>
              <button
                onClick={() => {
                  setCurrentMovie(null);
                  setShowListModal(true);
                }}
                className="flex items-center space-x-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-medium text-white transition-colors w-full sm:w-auto justify-center"
              >
                <FiPlus className="text-lg" />
                <span>New List</span>
              </button>
            </div>

            {userLists.length > 0 ? (
              <div className="space-y-6 sm:space-y-8">
                {userLists.map((list) => (
                  <motion.div
                    key={list.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 border border-gray-700"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      {editingListId === list.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editedListName}
                            onChange={(e) => setEditedListName(e.target.value)}
                            className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                          />
                          <button
                            onClick={saveEditedList}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingListId(null)}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded-lg text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold">{list.name}</h3>
                          <p className="text-gray-400 text-sm">
                            Created: {new Date(list.created_at).toLocaleDateString()} | 
                            Updated: {new Date(list.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      <div className="flex space-x-2 self-end sm:self-auto">
                        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">
                          {list.movies.length} {list.movies.length === 1 ? 'movie' : 'movies'}
                        </span>
                        <button
                          onClick={() => startEditingList(list)}
                          className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full hover:bg-gray-600"
                        >
                          <FiEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded-full hover:bg-red-800/50"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {renderMovieList(list)}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                <FiList className="mx-auto text-4xl text-gray-500 mb-4" />
                <h3 className="text-xl font-medium text-gray-400">No lists yet</h3>
                <p className="text-gray-500 mb-4">Create your first list to save movies</p>
                <button
                  onClick={() => {
                    setCurrentMovie(null);
                    setShowListModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-medium text-white transition-colors"
                >
                  Create New List
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* New List Modal */}
        <AnimatePresence>
          {showListModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setShowListModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md border border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    <FiList className="mr-2" />
                    {currentMovie ? `Save "${currentMovie.title}" to List` : 'Create New List'}
                  </h2>
                  <button
                    onClick={() => setShowListModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <FiX className="text-xl" />
                  </button>
                </div>
                
                <div className="mb-6">
  <h3 className="text-lg font-medium mb-2 flex items-center">
    <FiPlus className="mr-2" /> New List
  </h3>
  <div className="flex flex-col sm:flex-row gap-2">
    <input
      type="text"
      value={newListName}
      onChange={(e) => setNewListName(e.target.value)}
      placeholder="Enter list name"
      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
    />
    <button
      onClick={createNewList}
      disabled={!newListName.trim()}
      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
    >
      <FiCheck className="mr-1" />
      Create
    </button>
  </div>
</div>

{userLists.length > 0 && (
  <div>
    <h3 className="text-lg font-medium mb-2 flex items-center">
      <FiList className="mr-2" /> Existing Lists
    </h3>
    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
      {userLists.map((list) => (
        <div 
          key={list.id} 
          className={`flex justify-between items-center p-3 rounded-lg transition-colors ${selectedListId === list.id ? 'bg-blue-900/30' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          <div>
            <div className="font-medium">{list.name}</div>
            <div className="text-xs text-gray-400">{list.movies.length} movies</div>
          </div>
          {currentMovie && (
            <button
              onClick={() => {
                setSelectedListId(list.id);
                handleSaveToExistingList(currentMovie, list.id);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors text-sm"
            >
              Add
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Modal */}
        <AnimatePresence>
          {showAuthModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md border border-gray-700"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex justify-center w-full">
                    <div className="bg-blue-900/30 p-3 rounded-full">
                      <FiUser className="text-3xl text-blue-400" />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAuthModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <FiX className="text-xl" />
                  </button>
                </div>
                
                <h2 className="text-xl font-semibold mb-4 text-center">
                  {authMode === 'signin' ? 'Welcome Back!' : 'Create Your Account'}
                </h2>
                
                <form className="space-y-4">
                  {authMode === 'signup' && (
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="What should we call you?"
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                        required={authMode === 'signup'}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400"
                      required
                    />
                  </div>

                  {authError && (
                    <div className="bg-red-900/50 border border-red-700 rounded-lg p-3">
                      <p className="text-red-200 text-sm">{authError}</p>
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={authMode === 'signin' ? handleSignIn : handleSignUp}
                      disabled={authLoading}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {authLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Processing...
                        </>
                      ) : authMode === 'signin' ? (
                        <>
                          <FiLogIn className="mr-2" />
                          Sign In
                        </>
                      ) : (
                        <>
                          <FiUser className="mr-2" />
                          Create Account
                        </>
                      )}
                    </button>
                  </div>
                </form>
                
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    {authMode === 'signin' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-gray-800/80 backdrop-blur-sm py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <FiFilm className="text-xl text-blue-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                CineMatcher.ai
              </span>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 text-gray-400 text-sm sm:text-base">
            <span className="flex items-center gap-1">
    <FiUser className="text-blue-400" />
    <span>Developed by</span>
    <a
      href="https://shreeramsundar.netlify.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-blue-400 transition-colors font-medium"
    >
      Shree Ram Sundar
    </a>
  </span>
  <span className="flex items-center gap-1">
    <FiPhone className="text-blue-400" />
    <a href="tel:+918189967703" className="hover:text-blue-400 transition-colors">
      +91 81899-67703
    </a>
  </span>
  <span className="flex items-center gap-1">
    <FiMail className="text-blue-400" />
    <a
      href="https://mail.google.com/mail/?view=cm&to=shreeramsundar.t2023ai-ds@sece.ac.in"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-blue-400 transition-colors"
    >
      shreeramsundar.t2023ai-ds@sece.ac.in
    </a>
  </span>
</div>
          </div>
          <div className="mt-4 text-center md:text-left text-gray-500 text-sm">
            © {new Date().getFullYear()} CineMatcher.ai. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}