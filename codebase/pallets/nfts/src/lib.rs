#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::{
		pallet_prelude::*,
		traits::{tokens::ExistenceRequirement, Currency},
	};
	use frame_system::pallet_prelude::*;
	use scale_info::TypeInfo;

	#[cfg(feature = "std")]
	use frame_support::serde::{Deserialize, Serialize};

	type AccountOf<T> = <T as frame_system::Config>::AccountId;
	type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	// Struct for holding Nft information.

	#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound())]
	pub struct Nft<T: Config> {
		pub price: Option<BalanceOf<T>>, // None assumes that the Nft is not for sale.
		pub owner: AccountOf<T>,
		pub proof: [u8; 16],
		pub name: [u8; 16],
	}

	#[pallet::pallet]
	#[pallet::generate_store(pub(super) trait Store)]
	pub struct Pallet<T>(_);

	/// Configure the pallet by specifying the parameters and types it depends on.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// Because this pallet emits events, it depends on the runtime's definition of an event.
		type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;

		/// The Currency handler for the Nft pallet.
		type Currency: Currency<Self::AccountId>;

		// MaxNftOwned constant
		#[pallet::constant]
		type MaxNftsOwned: Get<u32>;
	}

	// Errors.
	#[pallet::error]
	pub enum Error<T> {
		/// Handles arithmetic overflow when incrementing the nft counter.
		CountForNftsOverflow,
		/// An account cannot own more Nfts than `MaxnftCount`.
		ExceedMaxNftsOwned,
		/// Buyer cannot be the owner.
		BuyerIsNftOwner,
		/// Cannot transfer a Nft to its owner.
		TransferToSelf,
		/// This Nft already exists
		NftExists,
		/// This Nft doesn't exist
		NftNotExist,
		/// Handles checking that the Nft is owned by the account transferring, buying or setting
		/// a price for it.
		NotNftOwner,
		/// Ensures the Nft is for sale.
		NftNotForSale,
		/// Ensures that the buying price is greater than the asking price.
		NftBidPriceTooLow,
		/// Ensures that an account has enough funds to purchase a Nft.
		NotEnoughBalance,
		// Ensure name isn't too short
		NameTooShort,
	}

	// Events.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A new nft was successfully created. \[sender, nft_id\]
		Created(T::AccountId, [u8; 16]),
		/// nft price was successfully set. \[sender, nft_id, new_price\]
		PriceSet(T::AccountId, [u8; 16], Option<BalanceOf<T>>),
		/// A nft was successfully transferred. \[from, to, nft_id\]
		Transferred(T::AccountId, T::AccountId, [u8; 16]),
		/// A nft was successfully bought. \[buyer, seller, nft_id, bid_price\]
		Bought(T::AccountId, T::AccountId, [u8; 16], BalanceOf<T>),
	}

	#[pallet::storage]
	#[pallet::getter(fn count_for_nfts)]
	pub(super) type CountForNfts<T: Config> = StorageValue<_, u64, ValueQuery>;

	// ACTION #7: Remaining storage items.
	#[pallet::storage]
	#[pallet::getter(fn nfts)]
	pub(super) type Nfts<T: Config> = StorageMap<_, Twox64Concat, [u8; 16], Nft<T>>;

	#[pallet::storage]
	#[pallet::getter(fn nfts_owned)]
	/// Keeps track of what accounts own what Nft.
	pub(super) type NftsOwned<T: Config> = StorageMap<
		_,
		Twox64Concat,
		T::AccountId,
		BoundedVec<[u8; 16], T::MaxNftsOwned>,
		ValueQuery,
	>;

	// Our pallet's genesis configuration.
	#[pallet::genesis_config]
	pub struct GenesisConfig<T: Config> {
		pub nfts: Vec<(T::AccountId, [u8; 16], [u8; 16])>,
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
			// When building a nft from genesis config, we require the proof to be
			// supplied.
			for (acct, proof, name) in &self.nfts {
				let _ = <Pallet<T>>::mint(acct, proof.clone(), name.clone());
			}
		}
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		#[pallet::weight(1_000_000_000)]
		pub fn create_nft(origin: OriginFor<T>, proof: [u8; 16], name: [u8; 16]) -> DispatchResult {
			let sender = ensure_signed(origin)?;

			ensure!((name[0] + name[1] + name[2]) != 0, Error::<T>::NameTooShort);

			let nft_id = Self::mint(&sender, proof.clone(), name.clone())?;

			Self::deposit_event(Event::Created(sender, nft_id));

			Ok(())
		}

		/// Set the price for a nft.
		#[pallet::weight(1_000_000_000)]
		pub fn set_price(
			origin: OriginFor<T>,
			nft_id: [u8; 16],
			new_price: Option<BalanceOf<T>>,
		) -> DispatchResult {
			let sender = ensure_signed(origin)?;

			ensure!(Self::is_nft_owner(&nft_id, &sender)?, <Error<T>>::NotNftOwner);

			let mut nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NftNotExist)?;

			// Set the Nft price and update new Nft infomation to storage.
			nft.price = new_price.clone();
			<Nfts<T>>::insert(&nft_id, nft);

			// Deposit a "PriceSet" event.
			Self::deposit_event(Event::PriceSet(sender, nft_id, new_price));

			Ok(())
		}

		#[pallet::weight(1_000_000_000)]
		pub fn transfer(
			origin: OriginFor<T>,
			to: T::AccountId,
			nft_id: [u8; 16],
		) -> DispatchResult {
			let from = ensure_signed(origin)?;

			// Ensure the nft exists and is called by the nft owner
			ensure!(Self::is_nft_owner(&nft_id, &from)?, <Error<T>>::NotNftOwner);

			// Verify the nft is not transferring back to its owner.
			ensure!(from != to, <Error<T>>::TransferToSelf);

			// Verify the recipient has the capacity to receive one more nft
			let to_owned = <NftsOwned<T>>::get(&to);
			ensure!(
				(to_owned.len() as u32) < T::MaxNftsOwned::get(),
				<Error<T>>::ExceedMaxNftsOwned
			);

			Self::transfer_nft_to(&nft_id, &to)?;

			Self::deposit_event(Event::Transferred(from, to, nft_id));

			Ok(())
		}

		// buy_nft
		#[pallet::weight(1_000_000_000)]
		pub fn buy_nft(
			origin: OriginFor<T>,
			nft_id: [u8; 16],
			bid_price: BalanceOf<T>,
		) -> DispatchResult {
			let buyer = ensure_signed(origin)?;

			// Check the nft exists and buyer is not the current nft owner
			let nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NftNotExist)?;
			ensure!(nft.owner != buyer, <Error<T>>::BuyerIsNftOwner);

			// ACTION #6: Check if the Nft is for sale.
			// Check the nft is for sale and the nft ask price <= bid_price
			if let Some(ask_price) = nft.price {
				ensure!(ask_price <= bid_price, <Error<T>>::NftBidPriceTooLow);
			} else {
				Err(<Error<T>>::NftNotForSale)?;
			}

			// Check the buyer has enough free balance
			ensure!(T::Currency::free_balance(&buyer) >= bid_price, <Error<T>>::NotEnoughBalance);

			// ACTION #7: Check if buyer can receive Nft.
			// Verify the buyer has the capacity to receive one more nft
			let to_owned = <NftsOwned<T>>::get(&buyer);
			ensure!(
				(to_owned.len() as u32) < T::MaxNftsOwned::get(),
				<Error<T>>::ExceedMaxNftsOwned
			);

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
		// ACTION #4: helper function for Nft struct

		// TODO Part III: helper functions for dispatchable functions

		// Helper to mint a Nft.
		pub fn mint(
			owner: &T::AccountId,
			proof: [u8; 16],
			name: [u8; 16],
		) -> Result<[u8; 16], Error<T>> {
			let nft = Nft::<T> {
				price: None,
				owner: owner.clone(),
				proof: proof.clone(),
				name: name.clone(),
			};

			// Performs this operation first as it may fail
			let new_cnt =
				Self::count_for_nfts().checked_add(1).ok_or(<Error<T>>::CountForNftsOverflow)?;

			// Check if the nft does not already exist in our storage map
			ensure!(Self::nfts(&nft.proof) == None, <Error<T>>::NftExists);

			// Performs this operation first as it may fail
			<NftsOwned<T>>::try_mutate(&owner, |nft_vec| nft_vec.try_push(nft.proof))
				.map_err(|_| <Error<T>>::ExceedMaxNftsOwned)?;

			// Get the block number from the FRAME System pallet.
			let current_block = <frame_system::Pallet<T>>::block_number();

			<Nfts<T>>::insert(nft.proof, nft);
			<CountForNfts<T>>::put(new_cnt);
			Ok(proof)
		}

		pub fn is_nft_owner(nft_id: &[u8; 16], acct: &T::AccountId) -> Result<bool, Error<T>> {
			match Self::nfts(nft_id) {
				Some(nft) => Ok(nft.owner == *acct),
				None => Err(<Error<T>>::NftNotExist),
			}
		}

		//Transactional attribute means that the function must return ok otherwise all
		//changes are discarded
		pub fn transfer_nft_to(nft_id: &[u8; 16], to: &T::AccountId) -> Result<(), Error<T>> {
			let mut nft = Self::nfts(&nft_id).ok_or(<Error<T>>::NftNotExist)?;

			let prev_owner = nft.owner.clone();

			// Remove `nft_id` from the NftsOwned vector of `prev_owner`
			<NftsOwned<T>>::try_mutate(&prev_owner, |owned| {
				if let Some(ind) = owned.iter().position(|&id| id == *nft_id) {
					owned.swap_remove(ind);
					return Ok(())
				}
				Err(())
			})
			.map_err(|_| <Error<T>>::NftNotExist)?;

			// Update the nft owner
			nft.owner = to.clone();
			// Reset the ask price so the nft is not for sale until `set_price()` is called
			// by the current owner.
			nft.price = None;

			<Nfts<T>>::insert(nft_id, nft);

			<NftsOwned<T>>::try_mutate(to, |vec| vec.try_push(*nft_id))
				.map_err(|_| <Error<T>>::ExceedMaxNftsOwned)?;

			Ok(())
		}
	}
}
