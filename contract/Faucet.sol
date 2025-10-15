// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;
// deployed with remix.ide

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Faucet is Ownable {
    // Mapping of token address to amount that can be minted per request
    mapping(address => uint256) public tokenAmounts;
    // Mapping of user address to token address to last mint timestamp
    mapping(address => mapping(address => uint256)) public lastMintTime;
    // Cooldown period (24 hours in seconds)
    uint256 public constant COOLDOWN_PERIOD = 24 * 60 * 60;
    
    // Events
    event TokenAdded(address indexed token, uint256 amount);
    event TokenRemoved(address indexed token);
    event TokensMinted(address indexed user, address indexed token, uint256 amount);
    
    // Errors
    error TokenNotAvailable();
    error CooldownNotExpired();
    error TransferFailed();
    error InvalidAmount();
    
    constructor() Ownable(msg.sender) {
        // Initialize with the specified tokens and amounts
        tokenAmounts[0xbA207113AAFbd1805786a953177eCdE780e5BbAB] = 1 ether; // 1 WETH
        tokenAmounts[0xF8e5aD1507f6b7e1637b4d20c115b470D48C582E] = 100 * 10**6; // 100 USDC (6 decimals)
        tokenAmounts[0xf0fa6cB8d05f55a7a86c93a9A5c210e935c72603] = 100 * 10**18; // 100 TCT (assuming 18 decimals)
        
        emit TokenAdded(0xbA207113AAFbd1805786a953177eCdE780e5BbAB, 1 ether);
        emit TokenAdded(0xF8e5aD1507f6b7e1637b4d20c115b470D48C582E, 100 * 10**6);
        emit TokenAdded(0xf0fa6cB8d05f55a7a86c93a9A5c210e935c72603, 100 * 10**18);
    }
    
    /**
     * @dev Add a new token to the faucet with specified amount
     * @param token The token contract address
     * @param amount The amount that can be minted per request
     */
    function addToken(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        tokenAmounts[token] = amount;
        emit TokenAdded(token, amount);
    }
    
    /**
     * @dev Remove a token from the faucet
     * @param token The token contract address to remove
     */
    function removeToken(address token) external onlyOwner {
        delete tokenAmounts[token];
        emit TokenRemoved(token);
    }
    
    /**
     * @dev Mint tokens from the faucet
     * @param token The token contract address to mint
     */
    function mint(address token) external {
        // Check if token is available
        if (tokenAmounts[token] == 0) revert TokenNotAvailable();
        
        // Check cooldown period
        if (msg.sender != owner() && block.timestamp < lastMintTime[msg.sender][token] + COOLDOWN_PERIOD) {
            revert CooldownNotExpired();
        }
        
        uint256 amount = tokenAmounts[token];
        
        // Update last mint time
        lastMintTime[msg.sender][token] = block.timestamp;
        
        // Transfer tokens to user
        bool success = IERC20(token).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        
        emit TokensMinted(msg.sender, token, amount);
    }
    
    /**
     * @dev Check if a user can mint a specific token
     * @param user The user address
     * @param token The token contract address
     * @return canMint True if user can mint the token
     */
    function canMint(address user, address token) external view returns (bool) {
        if (tokenAmounts[token] == 0) return false;
        return block.timestamp >= lastMintTime[user][token] + COOLDOWN_PERIOD;
    }
    
    /**
     * @dev Get the remaining cooldown time for a user and token
     * @param user The user address
     * @param token The token contract address
     * @return remainingTime The remaining cooldown time in seconds
     */
    function getRemainingCooldown(address user, address token) external view returns (uint256) {
        uint256 lastMint = lastMintTime[user][token];
        if (lastMint == 0) return 0;
        
        uint256 nextMintTime = lastMint + COOLDOWN_PERIOD;
        if (block.timestamp >= nextMintTime) return 0;
        
        return nextMintTime - block.timestamp;
    }
    
    /**
     * @dev Emergency function to withdraw tokens (only owner)
     * @param token The token contract address
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        bool success = IERC20(token).transfer(owner(), amount);
        if (!success) revert TransferFailed();
    }
}
