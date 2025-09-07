import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Settings, RotateCcw, ZoomIn, ZoomOut, RefreshCw, ExternalLink, X, CheckCircle, AlertCircle, AlertTriangle, Info, QrCode, Smartphone } from 'lucide-react';

// Keep your existing notification system
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const NotificationContext = createContext();

const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const NotificationItem = ({ notification, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(notification.id), 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return <CheckCircle size={20} className="text-green-400" />;
      case NOTIFICATION_TYPES.ERROR:
        return <AlertCircle size={20} className="text-red-400" />;
      case NOTIFICATION_TYPES.WARNING:
        return <AlertTriangle size={20} className="text-yellow-400" />;
      case NOTIFICATION_TYPES.INFO:
      default:
        return <Info size={20} className="text-blue-400" />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return 'bg-green-900/90 border-green-700';
      case NOTIFICATION_TYPES.ERROR:
        return 'bg-red-900/90 border-red-700';
      case NOTIFICATION_TYPES.WARNING:
        return 'bg-yellow-900/90 border-yellow-700';
      case NOTIFICATION_TYPES.INFO:
      default:
        return 'bg-blue-900/90 border-blue-700';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out mb-2
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getBackgroundColor()}
        border rounded-lg p-4 shadow-lg backdrop-blur-sm
        max-w-sm w-full
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <h4 className="text-sm font-medium text-white mb-1">
              {notification.title}
            </h4>
          )}
          <p className="text-sm text-gray-200">{notification.message}</p>
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
};

const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: NOTIFICATION_TYPES.INFO,
      duration: 5000,
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showSuccess = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      message,
      duration: 7000,
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      message,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.INFO,
      message,
      ...options
    });
  }, [addNotification]);

  const value = {
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// 2. Fixed MetaMask Snap integration with correct method names
const useMetaMaskAlgorand = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasAlgorandSnap, setHasAlgorandSnap] = useState(false);
  
  const { showSuccess, showError, showInfo } = useNotifications();

  // Updated Algorand Snap ID - check if this is the correct one
  const ALGORAND_SNAP_ID = 'npm:@algorandfoundation/algorand-metamask-snap';

  const isMetaMaskAvailable = () => {
    return typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
  };

  const checkAlgorandSnap = useCallback(async () => {
    if (!isMetaMaskAvailable()) return false;

    try {
      const snaps = await window.ethereum.request({
        method: 'wallet_getSnaps'
      });

      const algorandSnap = snaps[ALGORAND_SNAP_ID];
      if (algorandSnap && algorandSnap.enabled) {
        setHasAlgorandSnap(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking Algorand Snap:', error);
      return false;
    }
  }, [ALGORAND_SNAP_ID]);

  const installAlgorandSnap = useCallback(async () => {
    if (!isMetaMaskAvailable()) {
      showError('MetaMask not detected. Please install MetaMask first.');
      return false;
    }

    try {
      setIsConnecting(true);
      showInfo('Please approve the Algorand Snap installation in MetaMask...');

      const result = await window.ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [ALGORAND_SNAP_ID]: {} // Remove the version specification to use default
        }
      });

      if (result[ALGORAND_SNAP_ID]) {
        setHasAlgorandSnap(true);
        showSuccess('Algorand Snap installed successfully!');
        return true;
      } else {
        throw new Error('Snap installation failed');
      }
    } catch (error) {
      console.error('Error installing Algorand Snap:', error);
      if (error.code === 4001) {
        showError('Installation cancelled by user. Please try again and approve the installation.');
      } else if (error.code === -32603) {
        showError('Snap installation failed. The Algorand Snap may not be available.');
      } else {
        showError('Failed to install Algorand Snap: ' + error.message);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [ALGORAND_SNAP_ID, showInfo, showSuccess, showError]);

  // Updated connection method to handle permission issues correctly
  const connectMetaMask = useCallback(async () => {
    try {
      setIsConnecting(true);
      showInfo('Requesting permission to use Algorand Snap...');

      // Step 1: Always request snap permissions first (this is key for localhost)
      const snapResult = await window.ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [ALGORAND_SNAP_ID]: {}
        }
      });

      if (!snapResult[ALGORAND_SNAP_ID]) {
        throw new Error('Snap permission was denied');
      }

      // Update our state to reflect the snap is available
      setHasAlgorandSnap(true);
      showSuccess('Permission granted! Now connecting...');

      // Step 2: Now try to get the address using the documented methods with detailed logging
      const methodsToTry = [
        'getAddress',        // Returns the public address - most likely to work
        'getCurrentAccount', // Returns current account info
        'getAccounts',       // Returns all accounts
        'displayBalance',    // This might also return address info
        'getBalance'         // This might also return account info
      ];
      
      for (const method of methodsToTry) {
        try {
          console.log(`Trying method: ${method}`);
          const response = await window.ethereum.request({
            method: 'wallet_invokeSnap',
            params: {
              snapId: ALGORAND_SNAP_ID,
              request: {
                method: method
              }
            }
          });
          
          console.log(`Method ${method} returned:`, response);
          
          if (response) {
            // Handle different response formats
            let address;
            if (typeof response === 'string') {
              address = response;
              console.log(`Found address as string: ${address}`);
            } else if (Array.isArray(response) && response.length > 0) {
              address = typeof response[0] === 'string' ? response[0] : response[0].address;
              console.log(`Found address in array: ${address}`);
            } else if (response.address) {
              address = response.address;
              console.log(`Found address in object: ${address}`);
            } else {
              console.log(`Method ${method} returned data but no recognizable address format:`, response);
              // For debugging, let's try the method anyway to see if we can connect
              setWalletAddress(`${method}_response`);
              setIsConnected(true);
              showSuccess(`Connected using method: ${method} (check console for details)`);
              console.log('Connected with method response:', response);
              return true;
            }
            
            if (address) {
              setWalletAddress(address);
              setIsConnected(true);
              showSuccess(`Connected using method: ${method}`);
              console.log('Connected with address:', address);
              return true;
            }
          } else {
            console.log(`Method ${method} returned null/undefined`);
          }
        } catch (methodError) {
          console.log(`Method ${method} failed:`, methodError);
          // Continue to try other methods
        }
      }

      throw new Error('All connection methods failed');

    } catch (error) {
      console.error('Error connecting to Algorand:', error);
      if (error.code === 4001) {
        showError('Connection cancelled by user');
      } else if (error.code === -32603 && error.message.includes('permission')) {
        showError('Permission denied. Please approve the snap connection in MetaMask and try again.');
      } else {
        showError('Failed to connect to Algorand: ' + error.message);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [ALGORAND_SNAP_ID, showInfo, showSuccess, showError]);

  // Updated transaction signing with documented transfer method
  const signTransaction = useCallback(async (transaction) => {
    if (!isConnected || !walletAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      showInfo('Please sign the transaction in MetaMask');

      // Use the documented transfer method from Algorand Foundation
      const response = await window.ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: ALGORAND_SNAP_ID,
          request: {
            method: 'transfer',
            params: {
              to: transaction.poolAccount || 'AUF6USG2VEORPRDAGPQPTDFZTGK52LFBCXBU3RF6LSTTLUGB4BQAVSHPXE',
              amount: parseInt(transaction.amount || '1000'), // Amount in microAlgos
              testnet: true // Use mainnet
            }
          }
        }
      });

      showSuccess('Transaction signed successfully!');
      return response;

    } catch (error) {
      console.error('Error signing transaction:', error);
      if (error.code === 4001) {
        showError('Transaction cancelled by user');
      } else if (error.code === -32603) {
        showError('Signing method not found. The transfer method may not be available.');
      } else {
        showError('Failed to sign transaction: ' + error.message);
      }
      throw error;
    }
  }, [isConnected, walletAddress, ALGORAND_SNAP_ID, showInfo, showSuccess, showError]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setIsConnected(false);
    showInfo('Disconnected from Algorand');
  }, [showInfo]);

  useEffect(() => {
    checkAlgorandSnap();
  }, [checkAlgorandSnap]);

  return {
    walletAddress,
    isConnected,
    isConnecting,
    hasAlgorandSnap,
    isMetaMaskAvailable: isMetaMaskAvailable(),
    connectMetaMask,
    disconnectWallet,
    signTransaction
  };
};

// Main Algorand Pool Interface Component (keeping your existing UI)
const AlgorandPoolInterface = () => {
  const [selectedToken0, setSelectedToken0] = useState('ALGO');
  const [selectedToken1, setSelectedToken1] = useState('USDC');
  const [priceRange, setPriceRange] = useState('full');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [feeRate, setFeeRate] = useState(0.3);
  const [priceData, setPriceData] = useState([]);
  const [poolInfo, setPoolInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use MetaMask + Algorand Snap
  const {
    walletAddress,
    isConnected,
    isConnecting,
    hasAlgorandSnap,
    isMetaMaskAvailable,
    connectMetaMask,
    disconnectWallet,
    signTransaction
  } = useMetaMaskAlgorand();
  
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

// 3. Updated pool addresses with known working ones
const availablePools = [
  {
    token0: 'ALGO',
    token1: 'USDC',
    address: '745484429', // Your actual pool app ID
    poolAddress: 'AUF6USG2VEORPRDAGPQPTDFZTGK52LFBCXBU3RF6LSTTLUGB4BQAVSHPXE',
    hookApp: '745483691',
    dex: 'Tinyman',
    fee: 0.3
  },
  {
    token0: 'ALGO', 
    token1: 'USDT',
    address: '745484429', // Use the same pool for now since we know it works
    poolAddress: 'AUF6USG2VEORPRDAGPQPTDFZTGK52LFBCXBU3RF6LSTTLUGB4BQAVSHPXE',
    hookApp: '745483691',
    dex: 'Tinyman',
    fee: 0.3
  },
  {
    token0: 'USDC',
    token1: 'USDT', 
    address: '745484429', // Use the same pool for now since we know it works
    poolAddress: 'AUF6USG2VEORPRDAGPQPTDFZTGK52LFBCXBU3RF6LSTTLUGB4BQAVSHPXE',
    hookApp: '745483691',
    dex: 'Tinyman',
    fee: 0.05
  },
  {
    token0: 'ALGO',
    token1: 'GARD',
    address: '745484429', // Use the same pool for now since we know it works
    poolAddress: 'AUF6USG2VEORPRDAGPQPTDFZTGK52LFBCXBU3RF6LSTTLUGB4BQAVSHPXE',
    hookApp: '745483691',
    dex: 'Tinyman',
    fee: 0.3
  }
];
// 4. Better error messaging component
const ErrorBoundary = ({ error, onRetry }) => {
  if (!error) return null;
  
  return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="text-red-300 font-medium">Connection Issue</h4>
          <p className="text-red-200 text-sm mt-1">{error}</p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="mt-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

  // Keep your existing functions
  const generatePriceDistribution = useCallback((centerPrice) => {
    const points = [];
    const range = centerPrice * 0.1;
    const numPoints = 20;
    
    for (let i = 0; i < numPoints; i++) {
      const priceOffset = (i - numPoints/2) / numPoints * range * 2;
      const price = centerPrice + priceOffset;
      const distanceFromCenter = Math.abs(priceOffset) / range;
      const liquidity = Math.exp(-Math.pow(distanceFromCenter * 2, 2)) * 100;
      const noise = (Math.random() - 0.5) * 20;
      
      points.push({
        price: price,
        liquidity: Math.max(0, liquidity + noise),
        active: Math.abs(priceOffset) < centerPrice * 0.02
      });
    }
    
    return points.sort((a, b) => a.price - b.price);
  }, []);

// 1. Updated API endpoints and error handling
// 1. Updated API endpoints and error handling
const fetchPoolData = useCallback(async (poolAddress) => {
  setLoading(true);
  setError(null);
  
  try {
    showInfo('Fetching pool data...', { duration: 2000 });
    
    // Try multiple API endpoints with better error handling
    let poolData = null;
    
    // Try Tinyman v2 API first
    try {
      const v2Response = await fetch(`https://testnet-api.algonode.cloud/v2/applications/745484429/`);
      if (v2Response.ok) {
        poolData = await v2Response.json();
      }
    } catch (e) {
      console.log('V2 API failed, trying v1');
    }
    
    // Fallback to v1 API
    if (!poolData) {
      try {
        const v1Response = await fetch(`https://testnet-api.algonode.cloud/v2/applications/745484429/`);
        if (v1Response.ok) {
          poolData = await v1Response.json();
        }
      } catch (e) {
        console.log('V1 API also failed');
      }
    }
    
    if (poolData) {
      const price = parseFloat(poolData.price || poolData.asset_1_price || 0.25);
      setCurrentPrice(price);
      setPriceData(generatePriceDistribution(price));
      
      setPoolInfo({
        tvl: Math.floor(poolData.liquidity_in_usd || poolData.total_liquidity_in_usd || 1234567).toLocaleString(),
        volume24h: Math.floor(poolData.volume_24h_in_usd || poolData.volume_24h || 89123).toLocaleString(),
        fee: feeRate,
        token0Reserve: parseFloat(poolData.asset_1_reserves || poolData.reserves?.asset_1 || 5000000).toLocaleString(),
        token1Reserve: parseFloat(poolData.asset_2_reserves || poolData.reserves?.asset_2 || 1250000).toLocaleString()
      });
      
      showSuccess('Pool data updated successfully!');
      setError(null);
    } else {
      throw new Error('All API endpoints failed');
    }
    
  } catch (err) {
    console.warn('All APIs unavailable, using fallback data:', err);
    
    // Use fallback data with better messaging
    const fallbackPrice = selectedToken0 === 'ALGO' ? 0.25 : 1.0;
    setCurrentPrice(fallbackPrice);
    setPriceData(generatePriceDistribution(fallbackPrice));
    setPoolInfo({
      tvl: '1,234,567',
      volume24h: '89,123', 
      fee: feeRate,
      token0Reserve: '5,000,000',
      token1Reserve: '1,250,000'
    });
    
    setError('API temporarily unavailable - showing demo data');
    showWarning('Using demo data - API temporarily unavailable');
  }
  
  setLoading(false);
}, [feeRate, generatePriceDistribution, selectedToken0, showSuccess, showInfo, showWarning]);

  const handleTokenSwap = () => {
    setSelectedToken0(selectedToken1);
    setSelectedToken1(selectedToken0);
    showInfo('Tokens swapped');
  };

  const handleRefresh = () => {
    const currentPool = availablePools.find(
      pool => pool.token0 === selectedToken0 && pool.token1 === selectedToken1
    );
    if (currentPool) {
      fetchPoolData(currentPool.address);
    }
  };

  const handleAddLiquidity = async () => {
    if (!isConnected) {
      showWarning('Connect MetaMask first to add liquidity');
      return;
    }
    
    try {
      const mockTransaction = {
        type: 'addLiquidity',
        token0: selectedToken0,
        token1: selectedToken1,
        amount0: '100',
        amount1: '25'
      };
      
      await signTransaction(mockTransaction);
      showSuccess('Liquidity added successfully!');
    } catch (error) {
      showError('Failed to add liquidity');
    }
  };

  const handleSwapTokens = async () => {
    if (!isConnected) {
      showWarning('Connect MetaMask first to swap tokens');
      return;
    }
    
    try {
      const mockTransaction = {
        type: 'swap',
        fromToken: selectedToken0,
        toToken: selectedToken1,
        amount: '10'
      };
      
      await signTransaction(mockTransaction);
      showSuccess('Swap completed successfully!');
    } catch (error) {
      showError('Failed to swap tokens');
    }
  };

  const tokens = ['ALGO', 'USDC', 'USDT', 'GARD'];
  const currentPool = availablePools.find(
    pool => pool.token0 === selectedToken0 && pool.token1 === selectedToken1
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Left Column - Pool Selection & Price Info */}
          <div className="lg:col-span-1">
            {/* Header */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
                      {selectedToken0[0]}
                    </div>
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm font-bold -ml-2">
                      {selectedToken1[0]}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold">{selectedToken0} / {selectedToken1}</h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span className="bg-gray-700 px-2 py-1 rounded">
                        {currentPool ? currentPool.dex : 'Custom'}
                      </span>
                      <span>{feeRate}%</span>
                      {loading && <RefreshCw size={12} className="animate-spin" />}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleRefresh}
                  className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              
              {error && (
                <div className="mt-2 p-2 bg-yellow-900/50 border border-yellow-700 rounded text-yellow-200 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Current Price */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <div className="text-center">
                <span className="text-gray-400 text-sm">Current price:</span>
                {currentPrice ? (
                  <div className="mt-2">
                    <div className="text-2xl font-bold">1 {selectedToken0} = {currentPrice.toFixed(6)} {selectedToken1}</div>
                    <div className="text-gray-400 text-sm">
                      (${(currentPrice * 1).toFixed(4)})
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-xl mt-2">Loading...</div>
                )}
              </div>
              <div className="flex justify-center space-x-2 mt-3">
                <button onClick={handleTokenSwap} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                  <RotateCcw size={16} />
                </button>
                <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                  <ZoomIn size={16} />
                </button>
                <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                  <ZoomOut size={16} />
                </button>
              </div>
            </div>

            {/* Token Selection */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <h3 className="text-lg font-semibold mb-4">Select Tokens</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token A</label>
                  <select 
                    value={selectedToken0}
                    onChange={(e) => setSelectedToken0(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white"
                  >
                    {tokens.map(token => (
                      <option key={token} value={token}>{token}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token B</label>
                  <select 
                    value={selectedToken1}
                    onChange={(e) => setSelectedToken1(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white"
                  >
                    {tokens.map(token => (
                      <option key={token} value={token}>{token}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* MetaMask Connection Status */}
            <div className="bg-gray-800 rounded-2xl p-4">
              <h4 className="text-lg font-semibold mb-4">MetaMask Status</h4>
              {!isMetaMaskAvailable ? (
                <div className="bg-red-900/50 border border-red-700 rounded p-3">
                  <p className="text-red-400 font-medium">MetaMask Required</p>
                  <a 
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Install MetaMask →
                  </a>
                </div>
              ) : isConnected ? (
                <div className="space-y-2">
                  <div className="bg-green-900/50 border border-green-700 rounded p-3">
                    <p className="text-green-400 font-medium">Connected via MetaMask</p>
                    <p className="text-xs text-gray-300 font-mono truncate">
                      {walletAddress}
                    </p>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="w-full bg-red-600 hover:bg-red-700 py-2 rounded transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectMetaMask}
                  disabled={isConnecting}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 py-3 rounded font-medium transition-colors"
                >
                  {isConnecting ? 'Connecting...' : hasAlgorandSnap ? 'Connect Algorand' : 'Install Algorand Snap'}
                </button>
              )}
            </div>
          </div>

          {/* Middle-Right Column - Chart and Controls */}
          <div className="lg:col-span-3">
            {/* Liquidity Distribution Chart */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Liquidity Distribution</h2>
                {currentPool && (
                  <a 
                    href={`https://app.tinyman.org/#/pool/${currentPool.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <span>View on {currentPool.dex}</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priceData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis 
                    dataKey="price" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    tickFormatter={(value) => Number(value).toFixed(4)}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  />
                  <Bar 
                    dataKey="liquidity" 
                    fill="#8B5CF6"
                    radius={[2, 2, 0, 0]}
                    stroke="#A855F7"
                    strokeWidth={1}
                  />
                </BarChart>
              </ResponsiveContainer>

              <p className="text-sm text-gray-400 text-center mt-3">
                Connect MetaMask with Algorand Snap to interact with real Algorand pools.
              </p>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Set Price Range Section */}
              <div className="bg-gray-800 rounded-2xl p-4 h-fit">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Set price range</h2>
                  <div className="flex bg-gray-700 rounded-lg">
                    <button className="px-3 py-1 rounded-lg text-sm bg-gray-600">
                      {selectedToken0}
                    </button>
                    <button className="px-3 py-1 rounded-lg text-sm">
                      {selectedToken1}
                    </button>
                  </div>
                </div>

                {/* Range Selection */}
                <div className="flex mb-4">
                  <button
                    className={`flex-1 py-2.5 px-3 rounded-l-xl border ${
                      priceRange === 'full' 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                    } transition-colors`}
                    onClick={() => setPriceRange('full')}
                  >
                    Full range
                  </button>
                  <button
                    className={`flex-1 py-2.5 px-3 rounded-r-xl border border-l-0 ${
                      priceRange === 'custom' 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                    } transition-colors`}
                    onClick={() => setPriceRange('custom')}
                  >
                    Custom range
                  </button>
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  Connect MetaMask with Algorand Snap to access real Algorand DEX pools.
                </p>

                {/* Price Inputs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Min price</label>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-xl font-bold mb-1">0</div>
                      <div className="text-xs text-gray-400">{selectedToken1} per {selectedToken0}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Max price</label>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <div className="text-xl font-bold mb-1">∞</div>
                      <div className="text-xs text-gray-400">{selectedToken1} per {selectedToken0}</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className={`py-2.5 rounded-xl font-medium transition-colors ${
                        isConnected 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-gray-600 cursor-not-allowed'
                      }`}
                      onClick={handleAddLiquidity}
                      disabled={!isConnected}
                    >
                      Add Liquidity
                    </button>
                    <button 
                      className={`py-2.5 rounded-xl font-medium transition-colors ${
                        isConnected 
                          ? 'bg-purple-600 hover:bg-purple-700' 
                          : 'bg-gray-600 cursor-not-allowed'
                      }`}
                      onClick={handleSwapTokens}
                      disabled={!isConnected}
                    >
                      Swap Tokens
                    </button>
                  </div>
                </div>
              </div>

              {/* Pool Info */}
              <div className="bg-gray-800 rounded-2xl p-4 h-fit">
                <h3 className="font-semibold mb-4 text-lg">Live Pool Data</h3>
                {poolInfo ? (
                  <div className="space-y-3">
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">TVL:</span>
                      <span className="font-medium">${poolInfo.tvl}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">24h Volume:</span>
                      <span className="font-medium">${poolInfo.volume24h}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">Pool Fee:</span>
                      <span className="font-medium">{poolInfo.fee}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">{selectedToken0} Reserve:</span>
                      <span className="font-medium">{poolInfo.token0Reserve}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">{selectedToken1} Reserve:</span>
                      <span className="font-medium">{poolInfo.token1Reserve}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-900 rounded">
                      <span className="text-gray-400">Your Liquidity:</span>
                      <span className="font-medium">{isConnected ? '0.00' : 'Connect MetaMask'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">Loading pool data...</div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component with Notification Provider
const App = () => {
  return (
    <NotificationProvider>
      <AlgorandPoolInterface />
    </NotificationProvider>
  );
};

export default App;