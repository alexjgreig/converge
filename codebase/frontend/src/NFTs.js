import React, { useEffect, useState } from 'react'
import { Form, Input, Grid} from 'semantic-ui-react'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

// Polkadot-JS utilities for hashing data.
import { blake2AsHex } from '@polkadot/util-crypto'

import NftCards from './NftCards'

// Construct a Kitty ID from storage key
const convertToNftHash = entry =>
  `0x${entry[0].toJSON().slice(-64)}`;

// Construct a Kitty object 
const constructNft = (hash, { dna, price, gender, owner }) => ({
  id: hash,
  dna,
  price: price.toJSON(),
  gender: gender.toJSON(),
  owner: owner.toJSON()
});

function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
}


function stringToBytes(str) {
var buffer = new Buffer(str, 'utf16le');
for (var bytes = [], i = 0; i < buffer.length; i++) {
    bytes.push(buffer[i]);
}
while (bytes.length < 16) {
    bytes.push(0);
  }
return bytes.slice(0,16);
}

export default function Nfts(props) {
  const { api, keyring } = useSubstrateState()
  // const { accountPair } = props;
  const [nftHashes, setNftHashes] = useState([])
  const [nfts, setNfts] = useState([])
  const [status, setStatus] = useState('')
  const [digest, setDigest] = useState([])
  const [name, setName] = useState('')


// Subscription function for nft count
const subscribeCount = () => {
  let unsub = null

  const asyncFetch = async () => {
    unsub = await api.query.substrateNfts.countForNfts(
      async count => {
        // Fetch all nft keys
        const entries = await api.query.substrateNfts.nfts.entries()
        const hashes = entries.map(convertToNftHash)
        setNftHashes(hashes)
      }
    )
  }
  asyncFetch()

  return () => {
    unsub && unsub()
  }
}

// Subscription function to construct all nft objects
const subscribeNfts = () => {
  let unsub = null

  const asyncFetch = async () => {
    unsub = await api.query.substrateNfts.nfts.multi(
      nftHashes,
      nfts => {
	const nftsArr = nfts.map((nft,ind) => constructNft(nftHashes[ind], nft.value));
        setNfts(nftsArr);
      }
    )
  }

  asyncFetch()

  return () => {
    unsub && unsub()
  }
}
// Our `FileReader()` which is accessible from our functions below.
  let fileReader;
  // Takes our file, and creates a digest using the Blake2 256 hash function
  const bufferToDigest = () => {
    // Turns the file content to a hexadecimal representation.
    const content = Array.from(new Uint8Array(fileReader.result))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const hash = blake2AsHex(content, 256);
    const array = hexToBytes(hash); 

while (array.length < 16) {
    array.push(0);
  }
    setDigest(array.slice(0,16));
  };

  // Callback function for when a new file is selected.
  const handleFileChosen = file => {
    fileReader = new FileReader();
    fileReader.onloadend = bufferToDigest;
    fileReader.readAsArrayBuffer(file);
  };

const handleChange = event => {setName(event.target.value)}

useEffect(subscribeCount, [api, keyring])
useEffect(subscribeNfts, [api, keyring, nftHashes])

return (

<Grid.Column width={16}>
  <h1>Nfts</h1>
  <NftCards nfts={nfts} setStatus={setStatus}/>
	
<Form style={{ margin: '1em 0' }}>
 <Form.Field>
          {/* File selector with a callback to `handleFileChosen`. */}
          <Input
            type="file"
            id="file"
            label="Your File"
            onChange={e => handleFileChosen(e.target.files[0])}
          />
	<Input
              placeholder='Name of Fungible Asset'
              fluid
              type="text"
	      value={name}	
              onChange={handleChange}
            />
	</Form.Field>
      <Form.Field style={{ textAlign: 'center' }}>
        <TxButton
          label='Create Nft'
          type='SIGNED-TX'
          setStatus={setStatus}
          attrs={{
            palletRpc: 'substrateNfts',
            callable: 'createNft',
            inputParams: [digest, stringToBytes(name)],
            paramFields: [true, true]
          }}
        />
      </Form.Field>
    </Form>
<div style={{ overflowWrap: 'break-word' }}>{status}</div>
</Grid.Column>
)
}
