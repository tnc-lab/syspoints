// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SyspointsReviews {
    enum ReviewStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct ReviewAnchor {
        address user;
        bytes32 establishmentId;
        uint64 anchoredAt;
        uint64 reviewedAt;
        ReviewStatus status;
    }

    address public owner;
    mapping(bytes32 => ReviewAnchor) private reviews;
    mapping(bytes32 => bool) public effectExecuted;

    event ReviewAnchored(
        address indexed user,
        bytes32 indexed reviewHash,
        bytes32 indexed establishmentId,
        uint256 timestamp
    );
    event ReviewApproved(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp);
    event ReviewRejected(bytes32 indexed reviewHash, address indexed reviewer, uint256 timestamp);
    event ReviewEffectExecuted(bytes32 indexed reviewHash, address indexed executor, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidOwner();
    error ReviewAlreadyAnchored();
    error ReviewNotFound();
    error InvalidStatusTransition();
    error EffectAlreadyExecuted();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function anchorReview(
        address user,
        bytes32 reviewHash,
        bytes32 establishmentId
    ) external {
        require(user != address(0), "Invalid user");
        require(reviewHash != bytes32(0), "Invalid hash");
        require(establishmentId != bytes32(0), "Invalid establishment");
        if (reviews[reviewHash].status != ReviewStatus.None) revert ReviewAlreadyAnchored();

        reviews[reviewHash] = ReviewAnchor({
            user: user,
            establishmentId: establishmentId,
            anchoredAt: uint64(block.timestamp),
            reviewedAt: 0,
            status: ReviewStatus.Pending
        });

        emit ReviewAnchored(user, reviewHash, establishmentId, block.timestamp);
    }

    function anchorApprovedReview(
        address user,
        bytes32 reviewHash,
        bytes32 establishmentId
    ) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(reviewHash != bytes32(0), "Invalid hash");
        require(establishmentId != bytes32(0), "Invalid establishment");
        if (reviews[reviewHash].status != ReviewStatus.None) revert ReviewAlreadyAnchored();

        reviews[reviewHash] = ReviewAnchor({
            user: user,
            establishmentId: establishmentId,
            anchoredAt: uint64(block.timestamp),
            reviewedAt: uint64(block.timestamp),
            status: ReviewStatus.Approved
        });

        emit ReviewAnchored(user, reviewHash, establishmentId, block.timestamp);
        emit ReviewApproved(reviewHash, msg.sender, block.timestamp);
    }

    function approveReview(bytes32 reviewHash) external onlyOwner {
        ReviewAnchor storage review = reviews[reviewHash];
        if (review.status == ReviewStatus.None) revert ReviewNotFound();
        if (review.status != ReviewStatus.Pending) revert InvalidStatusTransition();

        review.status = ReviewStatus.Approved;
        review.reviewedAt = uint64(block.timestamp);

        emit ReviewApproved(reviewHash, msg.sender, block.timestamp);
    }

    function rejectReview(bytes32 reviewHash) external onlyOwner {
        ReviewAnchor storage review = reviews[reviewHash];
        if (review.status == ReviewStatus.None) revert ReviewNotFound();
        if (review.status != ReviewStatus.Pending) revert InvalidStatusTransition();

        review.status = ReviewStatus.Rejected;
        review.reviewedAt = uint64(block.timestamp);

        emit ReviewRejected(reviewHash, msg.sender, block.timestamp);
    }

    function executeApprovedReviewEffect(bytes32 reviewHash) external returns (bool) {
        ReviewAnchor storage review = reviews[reviewHash];
        if (review.status == ReviewStatus.None) revert ReviewNotFound();
        if (review.status != ReviewStatus.Approved) revert InvalidStatusTransition();
        if (effectExecuted[reviewHash]) revert EffectAlreadyExecuted();

        effectExecuted[reviewHash] = true;
        emit ReviewEffectExecuted(reviewHash, msg.sender, block.timestamp);
        return true;
    }

    function getReviewAnchor(bytes32 reviewHash) external view returns (
        address user,
        bytes32 establishmentId,
        uint256 anchoredAt,
        uint256 reviewedAt,
        ReviewStatus status,
        bool executed
    ) {
        ReviewAnchor memory review = reviews[reviewHash];
        return (
            review.user,
            review.establishmentId,
            uint256(review.anchoredAt),
            uint256(review.reviewedAt),
            review.status,
            effectExecuted[reviewHash]
        );
    }

    function getReviewStatus(bytes32 reviewHash) external view returns (ReviewStatus) {
        return reviews[reviewHash].status;
    }

    function isReviewApproved(bytes32 reviewHash) external view returns (bool) {
        return reviews[reviewHash].status == ReviewStatus.Approved;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
