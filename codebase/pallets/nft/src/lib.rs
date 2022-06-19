#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::{
		pallet_prelude::*,
		sp_runtime::traits::Hash,
		traits::{tokens::ExistenceRequirement, Currency, Randomness},
		transactional,
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;
	use sp_io::hashing::blake2_128;

	#[cfg(feature = "std")]
	use frame_support::serde::{Deserialize, Serialize};

	type AccountOf<T> = <T as frame_system::Config>::AccountId;
	type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	// Struct for holding NFT information.
	#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound())]
	pub struct NFT<T: Config> {
		pub price: Option<BalanceOf<T>>,
		pub owner: AccountOf<T>,
		pub proof: BoundedVec<u8, T::MaxBytesInHash>,
	}

	#[pallet::pallet]
	#[pallet::generate_store(pub(super) trait Store)]
	pub struct Pallet<T>(_);

	/// Configure the pallet by specifying the parameters and types it depends on.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// Because this pallet emits events, it depends on the runtime's definition of an event.
		type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;

		/// The Currency handler for the NFT pallet.
		type Currency: Currency<Self::AccountId>;

		type NFTRandomness: Randomness<Self::Hash, Self::BlockNumber>;

		// MaxNFTOwned constant
		#[pallet::constant]
		type MaxNFTOwned: Get<u32>;

		/// For constraining the maximum bytes of a hash used for any nft
		type MaxBytesInHash: Get<u32>;
	}

	// Errors.
	#[pallet::error]
	pub enum Error<T> {
		/// Handles arithmetic overflow when incrementing the nft counter.
		CountForNFTsOverflow,
		/// An account cannot own more NFTs than `MaxnftCount`.
		ExceedMaxNFTOwned,
		/// Buyer cannot be the owner.
		BuyerIsNFTOwner,
		/// Cannot transfer a NFT to its owner.
		TransferToSelf,
		/// This NFT already exists
		NFTExists,
		/// This NFT doesn't exist
		NFTNotExist,
		/// Handles checking that the NFT is owned by the account transferring, buying or setting
		/// a price for it.
		NotNFTOwner,
		/// Ensures the NFT is for sale.
		NFTNotForSale,
		/// Ensures that the buying price is greater than the asking price.
		NFTBidPriceTooLow,
		/// Ensures that an account has enough funds to purchase a NFT.
		NotEnoughBalance,
	}

	// Events.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A new nft was successfully created. \[sender, nft_id\]
		Created(T::AccountId, T::Hash),
		/// nft price was successfully set. \[sender, nft_id, new_price\]
		PriceSet(T::AccountId, T::Hash, Option<BalanceOf<T>>),
		/// A nft was successfully transferred. \[from, to, nft_id\]
		Transferred(T::AccountId, T::AccountId, T::Hash),
		/// A nft was successfully bought. \[buyer, seller, nft_id, bid_price\]
		Bought(T::AccountId, T::AccountId, T::Hash, BalanceOf<T>),
	}

	#[pallet::storage]
	#[pallet::getter(fn count_for_nfts)]
	pub(super) type CountForNFTs<T: Config> = StorageValue<_, u64, ValueQuery>;

	// ACTION #7: Remaining storage items.
	#[pallet::storage]
	#[pallet::getter(fn nfts)]
	pub(super) type NFTs<T: Config> = StorageMap<_, Twox64Concat, T::Hash, NFT<T>>;

	#[pallet::storage]
	#[pallet::getter(fn nfts_owned)]
	/// Keeps track of what accounts own what NFT.
	pub(super) type NFTsOwned<T: Config> =
		StorageMap<_, Twox64Concat, T::AccountId, BoundedVec<T::Hash, T::MaxNFTOwned>, ValueQuery>;

	// Our pallet's genesis configuration.
	#[pallet::genesis_config]
	pub struct GenesisConfig<T: Config> {
		pub nfts: Vec<(T::AccountId)>,
	}

	// Required to implement default for GenesisConfig.
	#[cfg(feature = "std")]
	impl<T: Config> Default for GenesisConfig<T> {
		fn default() -> GenesisConfig<T> {
			GenesisConfig { nfts: vec![] }
		}
	}

	#[pallet::genesis_build]
	impl<T: Config> GenesisBuild<T> for GenesisConfig<T> {
		fn build(&self) {
			// When building a nft from genesis config, we require the dna and gender to be
			// supplied.
			for (acct) in &self.nfts {
				let _ = <Pallet<T>>::mint(acct);
			}
		}
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		#[pallet::weight(100)]
		pub fn create_nft(
			origin: OriginFor<T>,
			proof: BoundedVec<u8, T::MaxBytesInHash>,
		) -> DispatchResult {
			let sender = ensure_signed(origin)?;
			let nft_id = Self::mint(&sender, &proof)?;

			Self::deposit_event(Event::Created(sender, nft_id));

			Ok(())
		}

		/// Set the price for a nft.
		#[pallet::weight(100)]
		pub fn set_price(
			origin: OriginFor<T>,
			nft_id: T::Hash,
			new_price: Option<BalanceOf<T>>,
		) -> DispatchResult {
			let sender = ensure_signed(origin)?;

			ensure!(Self::is_nft_owner(&nft_id, &sender)?, <Error<T>>::NotNFTOwner);

			let mut nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NFTNotExist)?;

			// Set the NFT price and update new NFT infomation to storage.
			nft.price = new_price.clone();
			<NFTs<T>>::insert(&nft_id, nft);

			// Deposit a "PriceSet" event.
			Self::deposit_event(Event::PriceSet(sender, nft_id, new_price));

			Ok(())
		}

		#[pallet::weight(100)]
		pub fn transfer(origin: OriginFor<T>, to: T::AccountId, nft_id: T::Hash) -> DispatchResult {
			let from = ensure_signed(origin)?;

			// Ensure the nft exists and is called by the nft owner
			ensure!(Self::is_nft_owner(&nft_id, &from)?, <Error<T>>::NotNFTOwner);

			// Verify the nft is not transferring back to its owner.
			ensure!(from != to, <Error<T>>::TransferToSelf);

			// Verify the recipient has the capacity to receive one more nft
			let to_owned = <NFTsOwned<T>>::get(&to);
			ensure!((to_owned.len() as u32) < T::MaxNFTOwned::get(), <Error<T>>::ExceedMaxNFTOwned);

			Self::transfer_nft_to(&nft_id, &to)?;

			Self::deposit_event(Event::Transferred(from, to, nft_id));

			Ok(())
		}

		// buy_nft
		#[transactional]
		#[pallet::weight(100)]
		pub fn buy_nft(
			origin: OriginFor<T>,
			nft_id: T::Hash,
			bid_price: BalanceOf<T>,
		) -> DispatchResult {
			let buyer = ensure_signed(origin)?;

			// Check the nft exists and buyer is not the current nft owner
			let nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NFTNotExist)?;
			ensure!(nft.owner != buyer, <Error<T>>::BuyerIsNFTOwner);

			// ACTION #6: Check if the NFT is for sale.
			// Check the nft is for sale and the nft ask price <= bid_price
			if let Some(ask_price) = nft.price {
				ensure!(ask_price <= bid_price, <Error<T>>::NFTBidPriceTooLow);
			} else {
				Err(<Error<T>>::NFTNotForSale)?;
			}

			// Check the buyer has enough free balance
			ensure!(T::Currency::free_balance(&buyer) >= bid_price, <Error<T>>::NotEnoughBalance);

			// ACTION #7: Check if buyer can receive NFT.
			// Verify the buyer has the capacity to receive one more nft
			let to_owned = <NFTsOwned<T>>::get(&buyer);
			ensure!((to_owned.len() as u32) < T::MaxNFTOwned::get(), <Error<T>>::ExceedMaxNFTOwned);

			let seller = nft.owner.clone();

			// ACTION #8: Update Balances using the Currency trait.
			// Transfer the amount from buyer to seller
			T::Currency::transfer(&buyer, &seller, bid_price, ExistenceRequirement::KeepAlive)?;

			// Transfer the nft from seller to buyer
			Self::transfer_nft_to(&nft_id, &buyer)?;

			// Deposit relevant Event
			Self::deposit_event(Event::Bought(buyer, seller, nft_id, bid_price));

			Ok(())
		}
	}

	//** Helper functions.**//

	impl<T: Config> Pallet<T> {
		// ACTION #4: helper function for NFT struct

		// TODO Part III: helper functions for dispatchable functions

		// Helper to mint a NFT.
		pub fn mint(
			owner: &T::AccountId,
			proof: &BoundedVec<u8, T::MaxBytesInHash>,
		) -> Result<T::Hash, Error<T>> {
			let nft = NFT::<T> { price: None, owner: owner.clone(), proof: proof.clone() };

			let nft_id = T::Hashing::hash_of(&nft);

			// Performs this operation first as it may fail
			let new_cnt =
				Self::count_for_nfts().checked_add(1).ok_or(<Error<T>>::CountForNFTsOverflow)?;

			// Check if the nft does not already exist in our storage map
			ensure!(Self::nfts(&nft_id) == None, <Error<T>>::NFTExists);

			// Performs this operation first as it may fail
			<NFTsOwned<T>>::try_mutate(&owner, |nft_vec| nft_vec.try_push(nft_id))
				.map_err(|_| <Error<T>>::ExceedMaxNFTOwned)?;

			// Get the block number from the FRAME System pallet.
			let current_block = <frame_system::Pallet<T>>::block_number();

			<NFTs<T>>::insert(nft_id, nft);
			<CountForNFTs<T>>::put(new_cnt);
			Ok(nft_id)
		}

		pub fn is_nft_owner(nft_id: &T::Hash, acct: &T::AccountId) -> Result<bool, Error<T>> {
			match Self::nfts(nft_id) {
				Some(nft) => Ok(nft.owner == *acct),
				None => Err(<Error<T>>::NFTNotExist),
			}
		}

		//Transactional attribute means that the function must return ok otherwise all
		//changes are discarded
		#[transactional]
		pub fn transfer_nft_to(nft_id: &T::Hash, to: &T::AccountId) -> Result<(), Error<T>> {
			let mut nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NFTNotExist)?;

			let prev_owner = nft.owner.clone();

			// Remove `nft_id` from the NFTsOwned vector of `prev_owner`
			<NFTsOwned<T>>::try_mutate(&prev_owner, |owned| {
				if let Some(ind) = owned.iter().position(|&id| id == *nft_id) {
					owned.swap_remove(ind);
					return Ok(())
				}
				Err(())
			})
			.map_err(|_| <Error<T>>::NFTNotExist)?;

			// Update the nft owner
			nft.owner = to.clone();
			// Reset the ask price so the nft is not for sale until `set_price()` is called
			// by the current owner.
			nft.price = None;

			<NFTs<T>>::insert(nft_id, nft);

			<NFTsOwned<T>>::try_mutate(to, |vec| vec.try_push(*nft_id))
				.map_err(|_| <Error<T>>::ExceedMaxNFTOwned)?;

			Ok(())
		}
	}
}
