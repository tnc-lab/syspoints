// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SYSPT is ERC20 {
    constructor() ERC20("Syspoints Token", "SYSPT") {}
}