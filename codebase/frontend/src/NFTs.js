import React, { useEffect, useState } from 'react'
import { Form, Input, Grid, Message} from 'semantic-ui-react'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

// Polkadot-JS utilities for hashing data.
import { blake2AsHex } from '@polkadot/util-crypto'

import NFTCards from './NFTCards'

const parseNFT = ({ price, owner, proof }) => ({
  price: price.toJSON(),
  owner: owner.toJSON(),
  proof,
})

export default function NFTs(props) {
  const { api, keyring } = useSubstrateState()
  const [nftIds, setNFTIds] = useState([])
  const [nfts, setNFTs] = useState([])
  const [status, setStatus] = useState('')
  const [digest, setDigest] = useState('')


// Subscription function for nft count
const subscribeCount = () => {
  let unsub = null
  const asyncFetch = async () => {
    unsub = await api.query.substrateNFTs.countForNFTs(
      async count => {
        // Fetch all nft keys
        const entries = await api.query.substrateNFTs.nfts.entries()
        const ids = entries.map(entry => entry[1].unwrap().proof)
        setNFTIds(ids)
      }
    )
  }
  asyncFetch()
  return () => {
    unsub && unsub()
  }
}

// Subscription function to construct all nft objects
const subscribeNFTs = () => {
  let unsub = null
  const asyncFetch = async () => {
    unsub = await api.query.substrateNFTs.nfts.multi(
      nftIds,
      nfts => {
        const nftsMap = nfts.map(nft => parseNFT(nft.unwrap()))
        setNFTs(nftsMap)
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
    setDigest(hash);
  };

  // Callback function for when a new file is selected.
  const handleFileChosen = file => {
    fileReader = new FileReader();
    fileReader.onloadend = bufferToDigest;
    fileReader.readAsArrayBuffer(file);
  };

useEffect(subscribeCount, [api, keyring])
useEffect(subscribeNFTs, [api, keyring, nftIds])

return (

<Grid.Column width={16}>
  <h1>NFTs</h1>
  <NFTCards nfts={nfts} setStatus={setStatus}/>
	
<Form style={{ margin: '1em 0' }}>
 <Form.Field>
          {/* File selector with a callback to `handleFileChosen`. */}
          <Input
            type="file"
            id="file"
            label="Your File"
            onChange={e => handleFileChosen(e.target.files[0])}
          />
	</Form.Field>
      <Form.Field style={{ textAlign: 'center' }}>
        <TxButton
          label='Create NFT'
          type='SIGNED-TX'
          setStatus={setStatus}
          attrs={{
            palletRpc: 'NFTs',
            callable: 'createNFT',
            inputParams: [],
            paramFields: []
          }}
        />
      </Form.Field>
    </Form>
    <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      <h1>Fungible Assets</h1>
      <Form>
        <Form.Field>
	<Message
            header=""
            
          />
        </Form.Field>
      </Form>
</Grid.Column>
)
}
